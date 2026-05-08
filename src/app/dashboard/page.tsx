'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';
import { PDFDocument } from 'pdf-lib';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'signature' | 'document' | 'place' | 'download';
type SigMode = 'draw' | 'type';

interface SigData { dataUrl: string; mode: SigMode }
interface DocData  { file: File; type: 'pdf' | 'image'; pageDataUrl: string; natW: number; natH: number }
interface Placement { x: number; y: number; w: number; h: number }

// ─── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string }[] = [
  { id: 'signature', label: 'Signature' },
  { id: 'document',  label: 'Document'  },
  { id: 'place',     label: 'Place'     },
  { id: 'download',  label: 'Download'  },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 ${i <= idx ? 'text-accent' : 'text-text3'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < idx  ? 'bg-accent border-accent text-white' :
              i === idx ? 'border-accent text-accent' :
                          'border-border text-text3'
            }`}>{i + 1}</div>
            <span className="text-xs font-medium hidden sm:block">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${i < idx ? 'bg-accent' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Signature ────────────────────────────────────────────────────────

function SignatureStep({ onNext }: { onNext: (sig: SigData) => void }) {
  const [mode,    setMode]    = useState<SigMode>('draw');
  const [text,    setText]    = useState('');
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    ctx.strokeStyle = '#1A1033';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const allStrokes = [...strokesRef.current, currentRef.current];
    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        const mid = { x: (stroke[i - 1].x + stroke[i].x) / 2, y: (stroke[i - 1].y + stroke[i].y) / 2 };
        ctx.quadraticCurveTo(stroke[i - 1].x, stroke[i - 1].y, mid.x, mid.y);
      }
      ctx.stroke();
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDrawing(true);
    currentRef.current = [getPos(e)];
    redraw();
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drawing) return;
    currentRef.current.push(getPos(e));
    redraw();
  }
  function onMouseUp() {
    if (!drawing) return;
    setDrawing(false);
    strokesRef.current.push([...currentRef.current]);
    currentRef.current = [];
    setHasStrokes(strokesRef.current.length > 0);
  }
  function onTouchStart(e: React.TouchEvent) { e.preventDefault(); setDrawing(true); currentRef.current = [getPos(e)]; }
  function onTouchMove(e: React.TouchEvent)  { e.preventDefault(); if (!drawing) return; currentRef.current.push(getPos(e)); redraw(); }
  function onTouchEnd()                       { onMouseUp(); }

  function clearCanvas() {
    strokesRef.current = [];
    currentRef.current = [];
    setHasStrokes(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  }

  function exportDrawing(): string {
    return canvasRef.current?.toDataURL('image/png') ?? '';
  }

  function exportText(): string {
    const canvas = document.createElement('canvas');
    canvas.width  = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'italic 52px Georgia, serif';
    ctx.fillStyle = '#1A1033';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 200, 60);
    return canvas.toDataURL('image/png');
  }

  function handleNext() {
    if (mode === 'draw' && !hasStrokes) return;
    if (mode === 'type' && !text.trim()) return;
    const dataUrl = mode === 'draw' ? exportDrawing() : exportText();
    onNext({ dataUrl, mode });
  }

  const canProceed = mode === 'draw' ? hasStrokes : text.trim().length > 0;

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Create your signature</h2>
      <p className="text-text2 text-sm mb-6">Draw or type your signature below</p>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {(['draw', 'type'] as SigMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              mode === m ? 'bg-accent text-white' : 'bg-surface border border-border text-text2 hover:border-accent'
            }`}
          >
            {m === 'draw' ? '✍️ Draw' : '⌨️ Type'}
          </button>
        ))}
      </div>

      {mode === 'draw' ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-border mb-4" style={{ height: 200, background: '#FAFAFE' }}>
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            style={{ touchAction: 'none' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
          {!hasStrokes && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-sm">Draw your signature here</p>
            </div>
          )}
          {hasStrokes && (
            <button
              onClick={clearCanvas}
              className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-white/80 border border-gray-200 text-xs text-gray-600 hover:bg-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your name"
            className="w-full px-4 py-4 rounded-xl bg-white border-2 border-border text-gray-800 text-2xl italic focus:outline-none focus:border-accent"
            style={{ fontFamily: 'Georgia, serif' }}
          />
        </div>
      )}

      <button onClick={handleNext} disabled={!canProceed} className="btn-primary">
        Next: Upload Document →
      </button>
    </div>
  );
}

// ─── Step 2: Document ─────────────────────────────────────────────────────────

async function renderPdfPage(file: File): Promise<{ dataUrl: string; natW: number; natH: number }> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const arrayBuffer = await file.arrayBuffer();
  const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page  = await pdf.getPage(1);
  const vp    = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width  = vp.width;
  canvas.height = vp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { dataUrl: canvas.toDataURL('image/png'), natW: vp.width, natH: vp.height };
}

function DocumentStep({ onNext, onBack }: { onNext: (doc: DocData) => void; onBack: () => void }) {
  const [doc,     setDoc]     = useState<DocData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError('');
    try {
      const isPdf = file.type === 'application/pdf';
      if (isPdf) {
        const { dataUrl, natW, natH } = await renderPdfPage(file);
        setDoc({ file, type: 'pdf', pageDataUrl: dataUrl, natW, natH });
      } else {
        const dataUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        const img = await new Promise<HTMLImageElement>((res) => {
          const i = new Image(); i.onload = () => res(i); i.src = dataUrl;
        });
        setDoc({ file, type: 'image', pageDataUrl: dataUrl, natW: img.naturalWidth, natH: img.naturalHeight });
      }
    } catch (err) { setError(`Failed to load file: ${err instanceof Error ? err.message : String(err)}`); }
    setLoading(false);
  }

  const fmt = (b: number) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} KB`;

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Upload document</h2>
      <p className="text-text2 text-sm mb-6">Select the PDF or image you want to sign</p>

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
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
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
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text1 truncate">{doc.file.name}</p>
            <p className="text-xs text-text3">{fmt(doc.file.size)} · {doc.type.toUpperCase()}</p>
          </div>
          <svg className="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
          ← Back
        </button>
        <button onClick={() => doc && onNext(doc)} disabled={!doc} className="flex-[2] btn-primary">
          Next: Place Signature →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Place ────────────────────────────────────────────────────────────

function PlaceStep({
  sig, doc, onNext, onBack,
}: { sig: SigData; doc: DocData; onNext: (p: Placement) => void; onBack: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>({ x: 60, y: 60, w: 160, h: 60 });
  const dragRef  = useRef<{ ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; initW: number; initH: number } | null>(null);

  function clamp(p: Placement): Placement {
    const el = containerRef.current;
    if (!el) return p;
    const { offsetWidth: cw, offsetHeight: ch } = el;
    return {
      ...p,
      x: Math.max(0, Math.min(p.x, cw - p.w)),
      y: Math.max(0, Math.min(p.y, ch - p.h)),
      w: Math.max(60, Math.min(p.w, cw)),
      h: Math.max(24, Math.min(p.h, ch)),
    };
  }

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { ox: e.clientX - placement.x, oy: e.clientY - placement.y };
    function move(ev: MouseEvent) {
      if (!dragRef.current) return;
      setPlacement(p => clamp({ ...p, x: ev.clientX - dragRef.current!.ox, y: ev.clientY - dragRef.current!.oy }));
    }
    function up() { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, initW: placement.w, initH: placement.h };
    function move(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const { startX, startY, initW, initH } = resizeRef.current;
      setPlacement(p => clamp({ ...p, w: Math.max(60, initW + ev.clientX - startX), h: Math.max(24, initH + ev.clientY - startY) }));
    }
    function up() { resizeRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Place your signature</h2>
      <p className="text-text2 text-sm mb-4">Drag the signature to position it on your document</p>

      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-border mb-4 select-none"
        style={{ maxHeight: 500, background: '#f5f5f5' }}
      >
        {/* Document page */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={doc.pageDataUrl} alt="document" className="w-full block" draggable={false} />

        {/* Signature overlay */}
        <div
          onMouseDown={onDragStart}
          style={{ left: placement.x, top: placement.y, width: placement.w, height: placement.h }}
          className="absolute border-2 border-accent rounded cursor-move bg-accent/5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sig.dataUrl} alt="signature" className="w-full h-full object-contain pointer-events-none" />
          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            className="absolute bottom-0 right-0 w-4 h-4 bg-accent rounded-tl cursor-se-resize"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
          ← Back
        </button>
        <button onClick={() => onNext(placement)} className="flex-[2] btn-primary">
          Finalize →
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Download ─────────────────────────────────────────────────────────

function DownloadStep({
  sig, doc, placement, onReset,
}: { sig: SigData; doc: DocData; placement: Placement; onReset: () => void }) {
  const { refresh } = useAuth();
  const [status,  setStatus]  = useState<'generating' | 'done' | 'error'>('generating');
  const [blobUrl, setBlobUrl] = useState('');
  const [fileName, setFileName] = useState('signed-document.pdf');
  const containerRef = useRef<HTMLDivElement>(null);

  const generate = useCallback(async () => {
    try {
      // 1. Check limit
      const { allowed } = await api.signatures.canSign();
      if (!allowed) { setStatus('error'); return; }

      // 2. Composite signature onto document
      const containerW = containerRef.current?.offsetWidth ?? doc.natW;
      const scaleX = doc.natW / containerW;
      const scaleY = scaleX;

      const canvas = document.createElement('canvas');
      canvas.width  = doc.natW;
      canvas.height = doc.natH;
      const ctx = canvas.getContext('2d')!;

      // Draw document page
      const docImg = await loadImage(doc.pageDataUrl);
      ctx.drawImage(docImg, 0, 0);

      // Draw signature
      const sigImg = await loadImage(sig.dataUrl);
      ctx.drawImage(
        sigImg,
        placement.x * scaleX,
        placement.y * scaleY,
        placement.w * scaleX,
        placement.h * scaleY,
      );

      const composited = canvas.toDataURL('image/png');

      // 3. Wrap in PDF
      const pdfDoc = await PDFDocument.create();
      const pngBytes = await fetch(composited).then(r => r.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const page = pdfDoc.addPage([doc.natW, doc.natH]);
      page.drawImage(pngImage, { x: 0, y: 0, width: doc.natW, height: doc.natH });
      const pdfBytes = await pdfDoc.save();

      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const name = `signed-${doc.file.name.replace(/\.[^.]+$/, '')}.pdf`;
      setBlobUrl(url);
      setFileName(name);

      // 4. Record usage
      await api.signatures.record(doc.file.name);
      await refresh();

      setStatus('done');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, [sig, doc, placement, refresh]);

  useEffect(() => { generate(); }, [generate]);

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
  }

  return (
    <div ref={containerRef}>
      <h2 className="text-xl font-bold text-text1 mb-1">
        {status === 'generating' ? 'Generating document…' : status === 'done' ? 'Document ready!' : 'Something went wrong'}
      </h2>
      <p className="text-text2 text-sm mb-8">
        {status === 'generating' ? 'Please wait while we apply your signature.' :
         status === 'done'       ? 'Your signed document is ready to download.' :
                                   'You may have reached your signing limit. Please upgrade your plan.'}
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
          </div>

          <a
            href={blobUrl}
            download={fileName}
            className="btn-primary flex items-center justify-center gap-2 no-underline"
          >
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

// ─── Dashboard root ────────────────────────────────────────────────────────────

function DashboardContent() {
  const { user } = useAuth();
  const [step,      setStep]      = useState<Step>('signature');
  const [sig,       setSig]       = useState<SigData | null>(null);
  const [doc,       setDoc]       = useState<DocData | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  function reset() {
    setSig(null); setDoc(null); setPlacement(null); setStep('signature');
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-base font-bold text-text1 flex-1">SignEase</span>
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
        <StepBar current={step} />

        {step === 'signature' && (
          <SignatureStep onNext={s => { setSig(s); setStep('document'); }} />
        )}
        {step === 'document' && (
          <DocumentStep
            onNext={d => { setDoc(d); setStep('place'); }}
            onBack={() => setStep('signature')}
          />
        )}
        {step === 'place' && sig && doc && (
          <PlaceStep
            sig={sig} doc={doc}
            onNext={p => { setPlacement(p); setStep('download'); }}
            onBack={() => setStep('document')}
          />
        )}
        {step === 'download' && sig && doc && placement && (
          <DownloadStep sig={sig} doc={doc} placement={placement} onReset={reset} />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <AuthGuard><DashboardContent /></AuthGuard>;
}
