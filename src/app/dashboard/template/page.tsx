'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';
import { PDFDocument } from 'pdf-lib';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'document' | 'mark' | 'sign' | 'download';
type SigMode = 'draw' | 'type';

interface Placement {
  x: number; y: number; w: number; h: number;
  page: number; pageW: number; pageH: number;
}

interface DocInfo {
  file: File;
  pageImages: { dataUrl: string; natW: number; natH: number }[];
}

interface SigData { dataUrl: string; mode: SigMode }

// ─── Step bar ─────────────────────────────────────────────────────────────────

const STEPS = ['Document', 'Mark Pages', 'Sign Once', 'Download'];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 ${i <= current ? 'text-accent' : 'text-text3'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < current  ? 'bg-accent border-accent text-white' :
              i === current ? 'border-accent text-accent' :
                              'border-border text-text3'
            }`}>{i + 1}</div>
            <span className="text-xs font-medium hidden sm:block">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${i < current ? 'bg-accent' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function renderAllPages(file: File): Promise<{ dataUrl: string; natW: number; natH: number }[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: { dataUrl: string; natW: number; natH: number }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pages.push({ dataUrl: canvas.toDataURL('image/png'), natW: vp.width, natH: vp.height });
  }
  return pages;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
  });
}

// ─── Step 1: Document ─────────────────────────────────────────────────────────

function DocStep({ onNext }: { onNext: (doc: DocInfo) => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [doc,     setDoc]     = useState<DocInfo | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError('');
    try {
      const isPdf = file.type === 'application/pdf';
      if (isPdf) {
        const pageImages = await renderAllPages(file);
        setDoc({ file, pageImages });
      } else {
        const dataUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        const img = await new Promise<HTMLImageElement>(res => {
          const i = new Image(); i.onload = () => res(i); i.src = dataUrl;
        });
        setDoc({ file, pageImages: [{ dataUrl, natW: img.naturalWidth, natH: img.naturalHeight }] });
      }
    } catch (err) {
      setError(`Failed to load file: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }

  const fmt = (b: number) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} KB`;

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Upload document</h2>
      <p className="text-text2 text-sm mb-6">Upload the document — you&apos;ll mark all signature spots, then sign once.</p>

      <label className="block cursor-pointer">
        <input type="file" accept=".pdf,image/*" onChange={handleFile} className="hidden" />
        <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-accent transition-colors">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-text2">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading document…</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-blue-400/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
              </div>
              <p className="text-text2 text-sm mb-1">Click to select a file</p>
              <p className="text-text3 text-xs">PDF or image (PNG, JPG)</p>
            </>
          )}
        </div>
      </label>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {doc && !loading && (
        <div className="mt-4 card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text1 truncate">{doc.file.name}</p>
            <p className="text-xs text-text3">{fmt(doc.file.size)} · {doc.pageImages.length} page{doc.pageImages.length !== 1 ? 's' : ''}</p>
          </div>
          <svg className="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
      )}

      <button onClick={() => doc && onNext(doc)} disabled={!doc || loading} className="btn-primary mt-6 w-full">
        Next: Mark Signature Spots →
      </button>
    </div>
  );
}

// ─── Step 2: Mark all pages ────────────────────────────────────────────────────

function MarkStep({
  doc, onNext, onBack,
}: { doc: DocInfo; onNext: (placements: Placement[]) => void; onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [placements,  setPlacements]  = useState<Placement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const dragRef   = useRef<{ idx: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ idx: number; startX: number; startY: number; initW: number; initH: number } | null>(null);

  const page = doc.pageImages[currentPage];
  const pagePlacements = placements.filter(p => p.page === currentPage);

  function clampP(p: Placement): Placement {
    const el = containerRef.current;
    if (!el) return p;
    return {
      ...p,
      x: Math.max(0, Math.min(p.x, el.offsetWidth - p.w)),
      y: Math.max(0, Math.min(p.y, el.offsetHeight - p.h)),
      w: Math.max(60, Math.min(p.w, el.offsetWidth)),
      h: Math.max(24, Math.min(p.h, el.offsetHeight)),
    };
  }

  function addPlacement() {
    const el = containerRef.current;
    const cw = el?.offsetWidth ?? 400;
    const ch = el?.offsetHeight ?? 400;
    setPlacements(prev => [...prev, {
      x: Math.max(0, cw / 2 - 80), y: Math.max(0, ch / 2 - 30),
      w: 160, h: 60,
      page: currentPage, pageW: page.natW, pageH: page.natH,
    }]);
  }

  function removePlacement(globalIdx: number) {
    setPlacements(prev => prev.filter((_, i) => i !== globalIdx));
  }

  function startDrag(e: React.MouseEvent, globalIdx: number) {
    e.preventDefault();
    const p = placements[globalIdx];
    dragRef.current = { idx: globalIdx, ox: e.clientX - p.x, oy: e.clientY - p.y };
    function move(ev: MouseEvent) {
      if (!dragRef.current) return;
      const { idx, ox, oy } = dragRef.current;
      setPlacements(prev => prev.map((item, i) =>
        i === idx ? clampP({ ...item, x: ev.clientX - ox, y: ev.clientY - oy }) : item
      ));
    }
    function up() { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function startResize(e: React.MouseEvent, globalIdx: number) {
    e.preventDefault(); e.stopPropagation();
    const p = placements[globalIdx];
    resizeRef.current = { idx: globalIdx, startX: e.clientX, startY: e.clientY, initW: p.w, initH: p.h };
    function move(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const { idx, startX, startY, initW, initH } = resizeRef.current;
      setPlacements(prev => prev.map((item, i) =>
        i === idx ? clampP({ ...item, w: Math.max(60, initW + ev.clientX - startX), h: Math.max(24, initH + ev.clientY - startY) }) : item
      ));
    }
    function up() { resizeRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function scaledPlacements(): Placement[] {
    const el = containerRef.current;
    if (!el) return placements;
    const displayW = el.offsetWidth;
    return placements.map(p => {
      const pageImg = doc.pageImages[p.page];
      const scale = pageImg.natW / displayW;
      return { ...p, x: p.x * scale, y: p.y * scale, w: p.w * scale, h: p.h * scale, pageW: pageImg.natW, pageH: pageImg.natH };
    });
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Mark signature spots</h2>
      <p className="text-text2 text-sm mb-4">Add spots on each page. Your signature will fill all spots automatically.</p>

      {doc.pageImages.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {doc.pageImages.map((_, i) => {
            const count = placements.filter(p => p.page === i).length;
            return (
              <button key={i} onClick={() => setCurrentPage(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  i === currentPage ? 'bg-accent text-white' : 'bg-surface2 border border-border text-text2 hover:border-accent'
                }`}>
                Page {i + 1}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-border mb-4 select-none"
        style={{ background: '#f5f5f5' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.dataUrl} alt={`Page ${currentPage + 1}`} className="w-full block" draggable={false} />

        {pagePlacements.map((p) => {
          const globalIdx = placements.indexOf(p);
          return (
            <div
              key={globalIdx}
              onMouseDown={e => startDrag(e, globalIdx)}
              style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
              className="absolute border-2 border-blue-400 rounded cursor-move bg-blue-400/10"
            >
              <div className="w-full h-full flex items-center justify-center pointer-events-none">
                <span className="text-blue-400 text-xs font-semibold opacity-60">Signature</span>
              </div>
              <button
                onMouseDown={e => { e.stopPropagation(); removePlacement(globalIdx); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center hover:opacity-80 z-10 pointer-events-auto"
              >×</button>
              <div onMouseDown={e => startResize(e, globalIdx)} className="absolute bottom-0 right-0 w-4 h-4 bg-blue-400 rounded-tl cursor-se-resize" />
            </div>
          );
        })}
      </div>

      <button onClick={addPlacement}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-400/50 text-blue-400 text-sm font-semibold hover:border-blue-400 transition-colors mb-6">
        + Add signature spot on page {currentPage + 1}
      </button>

      <p className="text-sm text-text2 mb-4">
        {placements.length === 0
          ? 'No spots added yet'
          : `${placements.length} spot${placements.length !== 1 ? 's' : ''} across ${new Set(placements.map(p => p.page)).size} page${new Set(placements.map(p => p.page)).size !== 1 ? 's' : ''}`}
      </p>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
          ← Back
        </button>
        <button onClick={() => onNext(scaledPlacements())} disabled={placements.length === 0}
          className="flex-[2] btn-primary disabled:opacity-50">
          Next: Sign Once →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Sign once ────────────────────────────────────────────────────────

function SignStep({ onNext, onBack }: { onNext: (sig: SigData) => void; onBack: () => void }) {
  const [mode,      setMode]      = useState<SigMode>('draw');
  const [text,      setText]      = useState('');
  const [drawing,   setDrawing]   = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const currentRef = useRef<{ x: number; y: number }[]>([]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const src = 'touches' in e ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

  function onMouseDown(e: React.MouseEvent) { e.preventDefault(); setDrawing(true); currentRef.current = [getPos(e)]; redraw(); }
  function onMouseMove(e: React.MouseEvent) { if (!drawing) return; currentRef.current.push(getPos(e)); redraw(); }
  function onMouseUp() {
    if (!drawing) return;
    setDrawing(false);
    strokesRef.current.push([...currentRef.current]);
    currentRef.current = [];
    setHasStrokes(strokesRef.current.length > 0);
  }
  function onTouchStart(e: React.TouchEvent) { e.preventDefault(); setDrawing(true); currentRef.current = [getPos(e)]; }
  function onTouchMove(e: React.TouchEvent)  { e.preventDefault(); if (!drawing) return; currentRef.current.push(getPos(e)); redraw(); }
  function onTouchEnd() { onMouseUp(); }

  function clearCanvas() {
    strokesRef.current = []; currentRef.current = []; setHasStrokes(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  }

  function handleNext() {
    if (mode === 'draw' && !hasStrokes) return;
    if (mode === 'type' && !text.trim()) return;
    let dataUrl: string;
    if (mode === 'draw') {
      dataUrl = canvasRef.current?.toDataURL('image/png') ?? '';
    } else {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 120;
      const ctx = c.getContext('2d')!;
      ctx.font = 'italic 52px Georgia, serif';
      ctx.fillStyle = '#1A1033';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 200, 60);
      dataUrl = c.toDataURL('image/png');
    }
    onNext({ dataUrl, mode });
  }

  const canProceed = mode === 'draw' ? hasStrokes : text.trim().length > 0;

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Sign once</h2>
      <p className="text-text2 text-sm mb-6">Your signature will be placed on all marked spots automatically.</p>

      <div className="flex gap-2 mb-6">
        {(['draw', 'type'] as SigMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              mode === m ? 'bg-accent text-white' : 'bg-surface border border-border text-text2 hover:border-accent'
            }`}>
            {m === 'draw' ? '✍️ Draw' : '⌨️ Type'}
          </button>
        ))}
      </div>

      {mode === 'draw' ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-border mb-4" style={{ height: 200, background: '#FAFAFE' }}>
          <canvas
            ref={canvasRef} width={600} height={200}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            style={{ touchAction: 'none' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          />
          {!hasStrokes && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-sm">Draw your signature here</p>
            </div>
          )}
          {hasStrokes && (
            <button onClick={clearCanvas} className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-white/80 border border-gray-200 text-xs text-gray-600 hover:bg-white transition-colors">
              Clear
            </button>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <input type="text" value={text} onChange={e => setText(e.target.value)}
            placeholder="Type your name"
            className="w-full px-4 py-4 rounded-xl bg-white border-2 border-border text-gray-800 text-2xl italic focus:outline-none focus:border-accent"
            style={{ fontFamily: 'Georgia, serif' }}
          />
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
          ← Back
        </button>
        <button onClick={handleNext} disabled={!canProceed} className="flex-[2] btn-primary disabled:opacity-50">
          Apply to All Spots →
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Download ─────────────────────────────────────────────────────────

function DownloadStep({
  doc, placements, sig, onReset,
}: { doc: DocInfo; placements: Placement[]; sig: SigData; onReset: () => void }) {
  const { refresh } = useAuth();
  const [status,   setStatus]   = useState<'generating' | 'done' | 'error'>('generating');
  const [blobUrl,  setBlobUrl]  = useState('');
  const [fileName, setFileName] = useState('signed-document.pdf');

  const generate = useCallback(async () => {
    try {
      const { allowed } = await api.signatures.canSign();
      if (!allowed) { setStatus('error'); return; }

      // Build a PDF with all pages, each with signatures applied
      const pdfDoc = await PDFDocument.create();
      const sigImg = await loadImage(sig.dataUrl);

      for (let pageIdx = 0; pageIdx < doc.pageImages.length; pageIdx++) {
        const pageInfo = doc.pageImages[pageIdx];
        const pagePlacements = placements.filter(p => p.page === pageIdx);

        // Composite signature(s) onto the page canvas
        const canvas = document.createElement('canvas');
        canvas.width  = pageInfo.natW;
        canvas.height = pageInfo.natH;
        const ctx = canvas.getContext('2d')!;

        const docImg = await loadImage(pageInfo.dataUrl);
        ctx.drawImage(docImg, 0, 0);

        for (const p of pagePlacements) {
          ctx.drawImage(sigImg, p.x, p.y, p.w, p.h);
        }

        const composited = canvas.toDataURL('image/png');
        const pngBytes = await fetch(composited).then(r => r.arrayBuffer());
        const pngImage = await pdfDoc.embedPng(pngBytes);
        const pdfPage  = pdfDoc.addPage([pageInfo.natW, pageInfo.natH]);
        pdfPage.drawImage(pngImage, { x: 0, y: 0, width: pageInfo.natW, height: pageInfo.natH });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const name = `signed-${doc.file.name.replace(/\.[^.]+$/, '')}.pdf`;
      setBlobUrl(url);
      setFileName(name);

      await api.signatures.record(doc.file.name);
      await refresh();
      setStatus('done');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, [doc, placements, sig, refresh]);

  useEffect(() => { generate(); }, [generate]);

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">
        {status === 'generating' ? 'Generating document…' : status === 'done' ? 'Document ready!' : 'Something went wrong'}
      </h2>
      <p className="text-text2 text-sm mb-8">
        {status === 'generating' ? `Applying your signature to ${placements.length} spot${placements.length !== 1 ? 's' : ''} across ${doc.pageImages.length} page${doc.pageImages.length !== 1 ? 's' : ''}…` :
         status === 'done'       ? 'Your signed document is ready to download.' :
                                   'You may have reached your signing limit or an error occurred.'}
      </p>

      {status === 'generating' && (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {status === 'done' && (
        <div className="space-y-4">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p className="text-lg font-bold text-text1 mb-1">Signed successfully</p>
            <p className="text-sm text-text2">{fileName}</p>
            <p className="text-xs text-text3 mt-1">{placements.length} signature{placements.length !== 1 ? 's' : ''} applied across {doc.pageImages.length} page{doc.pageImages.length !== 1 ? 's' : ''}</p>
          </div>
          <a href={blobUrl} download={fileName} className="btn-primary flex items-center justify-center gap-2 no-underline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download PDF
          </a>
          <button onClick={onReset} className="w-full py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
            Sign another document
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="card p-6 border-danger/30 bg-danger/5 text-center">
            <p className="text-danger font-semibold mb-2">Limit reached or error occurred</p>
            <p className="text-text2 text-sm">Upgrade your plan to continue signing documents.</p>
          </div>
          <Link href="/profile" className="btn-primary flex items-center justify-center no-underline">
            View Profile & Upgrade
          </Link>
          <button onClick={onReset} className="w-full py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Template root ─────────────────────────────────────────────────────────────

function TemplateContent() {
  const { user } = useAuth();
  const [step,       setStep]       = useState<Step>('document');
  const [doc,        setDoc]        = useState<DocInfo | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [sig,        setSig]        = useState<SigData | null>(null);

  const stepIdx: Record<Step, number> = { document: 0, mark: 1, sign: 2, download: 3 };

  function reset() {
    setDoc(null); setPlacements([]); setSig(null); setStep('document');
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text2 hover:border-accent transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="w-8 h-8 rounded-lg bg-blue-400/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span className="text-base font-bold text-text1 flex-1">Template Mode</span>
          {user && (
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:opacity-80 transition-opacity">
                {user.email[0].toUpperCase()}
              </div>
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <StepBar current={stepIdx[step]} />

        {step === 'document' && <DocStep onNext={d => { setDoc(d); setStep('mark'); }} />}
        {step === 'mark' && doc && (
          <MarkStep doc={doc} onNext={p => { setPlacements(p); setStep('sign'); }} onBack={() => setStep('document')} />
        )}
        {step === 'sign' && (
          <SignStep onNext={s => { setSig(s); setStep('download'); }} onBack={() => setStep('mark')} />
        )}
        {step === 'download' && doc && sig && (
          <DownloadStep doc={doc} placements={placements} sig={sig} onReset={reset} />
        )}
      </div>
    </div>
  );
}

export default function TemplatePage() {
  return <AuthGuard><TemplateContent /></AuthGuard>;
}
