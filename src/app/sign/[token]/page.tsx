'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type SigMode = 'draw' | 'type';
type PageStatus = 'loading' | 'ready' | 'preview' | 'signing' | 'done' | 'already_signed' | 'not_your_turn' | 'all_complete' | 'expired' | 'error';

interface Placement { x: number; y: number; w: number; h: number; page: number; pageW: number; pageH: number }
interface CompletedSlot { slot: number; label: string; signatureData: string; signedAt: string; placements: Placement[] }

interface SignerData {
  requestId: string;
  documentName: string;
  documentData: string;
  documentType: string;
  message: string | null;
  mySlot: number;
  myLabel: string;
  myPlacements: Placement[];
  futurePlacements: (Placement & { slot: number })[];
  completedSlots: CompletedSlot[];
  totalSlots: number;
}

// ─── Slot colors ──────────────────────────────────────────────────────────────

const SLOT_COLORS = [
  'border-purple-400 bg-purple-400/10 text-purple-400',
  'border-blue-400 bg-blue-400/10 text-blue-400',
  'border-green-400 bg-green-400/10 text-green-400',
  'border-orange-400 bg-orange-400/10 text-orange-400',
  'border-pink-400 bg-pink-400/10 text-pink-400',
  'border-teal-400 bg-teal-400/10 text-teal-400',
];
function slotColorClass(slot: number) { return SLOT_COLORS[(slot - 1) % SLOT_COLORS.length]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function renderPdfAllPages(dataUrl: string): Promise<{ dataUrl: string; natW: number; natH: number }[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages: { dataUrl: string; natW: number; natH: number }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    pages.push({ dataUrl: canvas.toDataURL('image/png'), natW: vp.width, natH: vp.height });
  }
  return pages;
}

// ─── Document page with all slot overlays ─────────────────────────────────────

function DocPageView({ pageImages, signerData, currentPage }: {
  pageImages: { dataUrl: string; natW: number; natH: number }[];
  signerData: SignerData;
  currentPage: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayW, setDisplayW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(e => setDisplayW(e[0].contentRect.width));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const page = pageImages[currentPage];
  const scale = displayW > 0 ? displayW / page.natW : 1;

  const mySpots     = signerData.myPlacements.filter(p => p.page === currentPage);
  const futureSpots = signerData.futurePlacements.filter(p => p.page === currentPage);

  return (
    <div ref={ref} className="relative rounded-xl overflow-hidden border border-border mb-4" style={{ background: '#f5f5f5' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page.dataUrl} alt={`Page ${currentPage + 1}`} className="w-full block" draggable={false} />

      {/* Completed slots: show their actual signatures */}
      {signerData.completedSlots.map(slot =>
        slot.placements.filter(p => p.page === currentPage).map((p, i) => (
          <div key={`done-${slot.slot}-${i}`} style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale }} className="absolute">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.signatureData} alt={slot.label} className="w-full h-full object-contain" />
          </div>
        ))
      )}

      {/* My spots: highlighted */}
      {mySpots.map((p, i) => (
        <div key={`mine-${i}`}
          style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale }}
          className="absolute border-2 border-accent rounded bg-accent/10 animate-pulse">
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-accent text-[10px] font-bold">Your signature here</span>
          </div>
        </div>
      ))}

      {/* Future slots: dimmed */}
      {futureSpots.map((p, i) => {
        const cc = slotColorClass(p.slot);
        return (
          <div key={`future-${i}`}
            style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale, opacity: 0.35 }}
            className={`absolute border-2 rounded ${cc}`}>
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] font-bold">Pending</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Signature pad ────────────────────────────────────────────────────────────

function SignaturePad({ onCapture, disabled }: { onCapture: (dataUrl: string) => void; disabled?: boolean }) {
  const [mode,      setMode]      = useState<SigMode>('draw');
  const [text,      setText]      = useState('');
  const [drawing,   setDrawing]   = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const currentRef = useRef<{ x: number; y: number }[]>([]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const src = 'touches' in e ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function redraw() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1A1033'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const stroke of [...strokesRef.current, currentRef.current]) {
      if (stroke.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        const mid = { x: (stroke[i-1].x + stroke[i].x)/2, y: (stroke[i-1].y + stroke[i].y)/2 };
        ctx.quadraticCurveTo(stroke[i-1].x, stroke[i-1].y, mid.x, mid.y);
      }
      ctx.stroke();
    }
  }

  function onMouseDown(e: React.MouseEvent) { e.preventDefault(); setDrawing(true); currentRef.current = [getPos(e)]; }
  function onMouseMove(e: React.MouseEvent) { if (!drawing) return; currentRef.current.push(getPos(e)); redraw(); }
  function onMouseUp() {
    if (!drawing) return; setDrawing(false);
    strokesRef.current.push([...currentRef.current]); currentRef.current = [];
    setHasStrokes(strokesRef.current.length > 0);
  }
  function onTouchStart(e: React.TouchEvent) { e.preventDefault(); setDrawing(true); currentRef.current = [getPos(e)]; }
  function onTouchMove(e: React.TouchEvent)  { e.preventDefault(); if (!drawing) return; currentRef.current.push(getPos(e)); redraw(); }
  function onTouchEnd() { onMouseUp(); }
  function clearCanvas() {
    strokesRef.current = []; currentRef.current = []; setHasStrokes(false);
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function capture() {
    if (mode === 'draw') { onCapture(canvasRef.current?.toDataURL('image/png') ?? ''); return; }
    const c = document.createElement('canvas'); c.width = 400; c.height = 120;
    const ctx = c.getContext('2d')!;
    ctx.font = 'italic 52px Georgia, serif'; ctx.fillStyle = '#1A1033';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 200, 60);
    onCapture(c.toDataURL('image/png'));
  }

  const canProceed = mode === 'draw' ? hasStrokes : text.trim().length > 0;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['draw', 'type'] as SigMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} disabled={disabled}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
              mode === m ? 'bg-accent text-white' : 'bg-surface border border-border text-text2 hover:border-accent'
            }`}>
            {m === 'draw' ? '✍️ Draw' : '⌨️ Type'}
          </button>
        ))}
      </div>

      {mode === 'draw' ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-border mb-4" style={{ height: 180, background: '#FAFAFE' }}>
          <canvas ref={canvasRef} width={600} height={180} className="absolute inset-0 w-full h-full cursor-crosshair" style={{ touchAction: 'none' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
          {!hasStrokes && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><p className="text-gray-400 text-sm">Draw your signature here</p></div>}
          {hasStrokes && (
            <button onClick={clearCanvas} className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-white/80 border border-gray-200 text-xs text-gray-600 hover:bg-white">Clear</button>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type your name" disabled={disabled}
            className="w-full px-4 py-4 rounded-xl bg-white border-2 border-border text-gray-800 text-2xl italic focus:outline-none focus:border-accent disabled:opacity-50"
            style={{ fontFamily: 'Georgia, serif' }} />
        </div>
      )}

      <button onClick={capture} disabled={!canProceed || disabled} className="btn-primary w-full disabled:opacity-50">
        Preview Signature →
      </button>
    </div>
  );
}

// ─── Signature preview pane ───────────────────────────────────────────────────

function SignaturePreview({ sigDataUrl, pageImages, signerData, onConfirm, onRedo }: {
  sigDataUrl: string;
  pageImages: { dataUrl: string; natW: number; natH: number }[];
  signerData: SignerData;
  onConfirm: () => void;
  onRedo: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayW, setDisplayW] = useState(0);
  const [previewPage, setPreviewPage] = useState(() => {
    // Default to first page that has a spot for this signer
    const firstPage = signerData.myPlacements[0]?.page ?? 0;
    return firstPage;
  });

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(e => setDisplayW(e[0].contentRect.width));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const pagesWithMySpots = [...new Set(signerData.myPlacements.map(p => p.page))];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        </div>
        <div>
          <p className="text-sm font-bold text-text1">Preview your signature</p>
          <p className="text-xs text-text3">This is how it will appear on the document</p>
        </div>
      </div>

      {/* Signature preview box */}
      <div className="card p-4 mb-4 bg-white">
        <p className="text-xs font-semibold text-text3 uppercase tracking-wider mb-2">Your signature</p>
        <div className="rounded-xl border border-border bg-gray-50 p-3 flex items-center justify-center" style={{ minHeight: 80 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sigDataUrl} alt="Your signature" className="max-h-20 object-contain" style={{ maxWidth: '100%' }} />
        </div>
      </div>

      {/* Page tabs — only show pages with this signer's spots */}
      {pagesWithMySpots.length > 1 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {pagesWithMySpots.map(pageIdx => (
            <button key={pageIdx} onClick={() => setPreviewPage(pageIdx)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                previewPage === pageIdx ? 'bg-accent text-white' : 'bg-surface2 border border-border text-text2 hover:border-accent'
              }`}>
              Page {pageIdx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Document page with signature placed */}
      <div ref={ref} className="relative rounded-xl overflow-hidden border-2 border-accent/40 mb-5" style={{ background: '#f5f5f5' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pageImages[previewPage].dataUrl} alt={`Page ${previewPage + 1}`} className="w-full block" draggable={false} />

        {/* Already-completed slots */}
        {signerData.completedSlots.map(slot =>
          slot.placements.filter(p => p.page === previewPage).map((p, i) => {
            const scale = displayW > 0 ? displayW / p.pageW : 1;
            return (
              <div key={`done-${slot.slot}-${i}`} style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale }} className="absolute">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slot.signatureData} alt={slot.label} className="w-full h-full object-contain" />
              </div>
            );
          })
        )}

        {/* MY signature overlaid at my spots */}
        {signerData.myPlacements.filter(p => p.page === previewPage).map((p, i) => {
          const scale = displayW > 0 ? displayW / p.pageW : 1;
          return (
            <div key={`mine-${i}`} style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale }} className="absolute">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sigDataUrl} alt="Your signature" className="w-full h-full object-contain" />
            </div>
          );
        })}

        {/* Preview badge */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-accent/90 text-white text-[10px] font-bold">
          Preview
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={onRedo}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-text2 text-sm font-semibold hover:border-danger hover:text-danger transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Redo signature
        </button>
        <button onClick={onConfirm}
          className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-success text-white text-sm font-semibold hover:bg-success/90 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Confirm &amp; Submit
        </button>
      </div>
      <p className="text-xs text-text3 text-center mt-3">Once confirmed, your signature cannot be changed.</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicSignPage() {
  const { token } = useParams<{ token: string }>();

  const [status,       setStatus]       = useState<PageStatus>('loading');
  const [signerData,   setSignerData]   = useState<SignerData | null>(null);
  const [pageImages,   setPageImages]   = useState<{ dataUrl: string; natW: number; natH: number }[]>([]);
  const [currentPage,  setCurrentPage]  = useState(0);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [isComplete,   setIsComplete]   = useState(false);
  const [pendingSigDataUrl, setPendingSigDataUrl] = useState('');

  useEffect(() => {
    api.requests.getForSigner(token)
      .then(async data => {
        setSignerData(data);
        const pages = data.documentType === 'pdf'
          ? await renderPdfAllPages(data.documentData)
          : await (async () => {
              const img = await loadImage(data.documentData);
              return [{ dataUrl: data.documentData, natW: img.naturalWidth, natH: img.naturalHeight }];
            })();
        setPageImages(pages);
        setStatus('ready');
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Already signed'))                          setStatus('already_signed');
        else if (msg.includes('not_your_turn'))                      setStatus('not_your_turn');
        else if (msg.includes('fully signed') || msg.includes('Document fully')) setStatus('all_complete');
        else if (msg.includes('request_expired'))                    setStatus('expired');
        else { setErrorMsg(msg); setStatus('error'); }
      });
  }, [token]);

  // Step 1: capture → show preview
  const handlePreview = useCallback((sigDataUrl: string) => {
    setPendingSigDataUrl(sigDataUrl);
    setStatus('preview');
  }, []);

  // Step 2: confirm preview → submit to backend
  const handleSign = useCallback(async () => {
    if (!signerData || !pendingSigDataUrl) return;
    setStatus('signing');
    try {
      const res = await api.requests.sign(token, pendingSigDataUrl);
      setIsComplete(res.complete);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit signature');
      setStatus('error');
    }
  }, [signerData, token, pendingSigDataUrl]);

  // ── Loading ──
  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Already signed ──
  if (status === 'already_signed') return (
    <CenteredCard icon="✓" iconClass="bg-success/10 border-success/30 text-success" title="Already signed" message="You have already signed this document." />
  );

  // ── Not your turn ──
  if (status === 'not_your_turn') return (
    <CenteredCard icon="⏳" iconClass="bg-accent/10 border-accent/30 text-accent" title="Not your turn yet"
      message="You will receive an email notification when it is your turn to sign." />
  );

  // ── Expired ──
  if (status === 'expired') return (
    <CenteredCard icon="⏰" iconClass="bg-danger/10 border-danger/30 text-danger" title="Signing link expired"
      message="This signing request has expired. Please contact the document owner to create a new request." />
  );

  // ── All complete ──
  if (status === 'all_complete') return (
    <CenteredCard icon="✓" iconClass="bg-success/10 border-success/30 text-success" title="Document fully signed"
      message="All parties have signed this document." />
  );

  // ── Error ──
  if (status === 'error') return (
    <CenteredCard icon="✕" iconClass="bg-danger/10 border-danger/30 text-danger" title="Something went wrong"
      message={errorMsg || 'This signing link is invalid or has expired.'} />
  );

  // ── Done ──
  if (status === 'done') return (
    <CenteredCard
      icon="✓"
      iconClass="bg-success/10 border-success/30 text-success"
      title="Document signed!"
      message={isComplete
        ? 'All parties have now signed. The document owner has been notified and can download the final document.'
        : 'Thank you! The next signer has been notified by email and will be prompted to sign.'}
    />
  );

  // ── Preview ──
  if (status === 'preview' && signerData && pageImages.length > 0) return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <span className="text-base font-bold text-text1 flex-1">iSigner · Signature Preview</span>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <SignaturePreview
          sigDataUrl={pendingSigDataUrl}
          pageImages={pageImages}
          signerData={signerData}
          onConfirm={handleSign}
          onRedo={() => setStatus('ready')}
        />
      </div>
    </div>
  );

  // ── Signing in progress (spinner) ──
  if (status === 'signing') return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text2 text-sm">Submitting your signature…</p>
      </div>
    </div>
  );

  // ── Ready to sign ──
  if (!signerData) return null;

  const hasAnySpotsOnPage = (pageIdx: number) =>
    signerData.myPlacements.some(p => p.page === pageIdx) ||
    signerData.completedSlots.some(s => s.placements.some(p => p.page === pageIdx)) ||
    signerData.futurePlacements.some(p => p.page === pageIdx);

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div className="flex-1">
            <span className="text-base font-bold text-text1">iSigner</span>
            <span className="text-text3 text-xs ml-2">· Signing request</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Info */}
        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1 className="text-lg font-bold text-text1">You have been asked to sign</h1>
            <span className="shrink-0 text-xs font-semibold text-accent bg-accent/10 border border-accent/30 px-2.5 py-1 rounded-full">
              Signer {signerData.mySlot} of {signerData.totalSlots}
            </span>
          </div>
          <p className="text-sm text-text2 truncate font-medium mb-1">{signerData.documentName}</p>
          {signerData.message && (
            <div className="mt-3 p-3 rounded-xl bg-surface2 border border-border">
              <p className="text-xs text-text3 mb-0.5 font-semibold uppercase tracking-wider">Message</p>
              <p className="text-sm text-text2">{signerData.message}</p>
            </div>
          )}
        </div>

        {/* Signing progress bar */}
        {signerData.totalSlots > 1 && (
          <div className="card p-4 mb-6">
            <p className="text-xs font-semibold text-text3 uppercase tracking-wider mb-3">Signing progress</p>
            <div className="flex items-center gap-2">
              {Array.from({ length: signerData.totalSlots }, (_, i) => {
                const slot = i + 1;
                const isDone = signerData.completedSlots.some(s => s.slot === slot);
                const isMine = slot === signerData.mySlot;
                return (
                  <div key={slot} className="flex items-center gap-2 flex-1">
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      isDone ? 'bg-success border-success text-white' :
                      isMine ? 'border-accent text-accent' :
                               'border-border text-text3'
                    }`}>
                      {isDone ? '✓' : slot}
                    </div>
                    {i < signerData.totalSlots - 1 && <div className={`flex-1 h-px ${isDone ? 'bg-success' : 'bg-border'}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Page tabs */}
        {pageImages.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {pageImages.map((_, i) => (
              <button key={i} onClick={() => setCurrentPage(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  i === currentPage ? 'bg-accent text-white' : 'bg-surface2 border border-border text-text2 hover:border-accent'
                }`}>
                Page {i + 1}{hasAnySpotsOnPage(i) ? ' ·' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Document view */}
        {pageImages.length > 0 && (
          <DocPageView pageImages={pageImages} signerData={signerData} currentPage={currentPage} />
        )}

        {/* Signature pad */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
              {signerData.mySlot}
            </div>
            <div>
              <p className="text-sm font-bold text-text1">Your signature — {signerData.myLabel}</p>
              <p className="text-xs text-text3">{signerData.myPlacements.length} spot{signerData.myPlacements.length !== 1 ? 's' : ''} across all pages</p>
            </div>
          </div>
          <SignaturePad onCapture={handlePreview} />
        </div>

        <p className="text-xs text-text3 text-center">
          By signing, you agree this is a legally binding electronic signature.
        </p>
      </div>
    </div>
  );
}

// ─── Reusable centered card ────────────────────────────────────────────────────

function CenteredCard({ icon, iconClass, title, message }: { icon: string; iconClass: string; title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="max-w-sm w-full text-center">
        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-bold mx-auto mb-4 ${iconClass}`}>
          {icon}
        </div>
        <h1 className="text-xl font-bold text-text1 mb-2">{title}</h1>
        <p className="text-text2 text-sm">{message}</p>
      </div>
    </div>
  );
}
