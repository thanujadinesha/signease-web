'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PDFDocument } from 'pdf-lib';

// ─── Types ────────────────────────────────────────────────────────────────────

type SigMode = 'draw' | 'type';
type Status = 'loading' | 'ready' | 'signing' | 'done' | 'error' | 'already_signed';

interface Placement {
  x: number; y: number; w: number; h: number;
  page: number; pageW: number; pageH: number;
}

interface RequestData {
  id: string;
  documentName: string;
  documentData: string;
  documentType: string;
  recipientEmail: string | null;
  message: string | null;
  placements: Placement[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
  });
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
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pages.push({ dataUrl: canvas.toDataURL('image/png'), natW: vp.width, natH: vp.height });
  }
  return pages;
}

// ─── Signature pad ────────────────────────────────────────────────────────────

function SignaturePad({ onCapture }: { onCapture: (dataUrl: string) => void }) {
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

  function onMouseDown(e: React.MouseEvent) { e.preventDefault(); setDrawing(true); currentRef.current = [getPos(e)]; }
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

  function capture() {
    if (mode === 'draw') {
      onCapture(canvasRef.current?.toDataURL('image/png') ?? '');
    } else {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 120;
      const ctx = c.getContext('2d')!;
      ctx.font = 'italic 52px Georgia, serif';
      ctx.fillStyle = '#1A1033';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 200, 60);
      onCapture(c.toDataURL('image/png'));
    }
  }

  const canProceed = mode === 'draw' ? hasStrokes : text.trim().length > 0;

  return (
    <div>
      <div className="flex gap-2 mb-4">
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
        <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-border mb-4" style={{ height: 180, background: '#FAFAFE' }}>
          <canvas
            ref={canvasRef} width={600} height={180}
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
            <button onClick={clearCanvas} className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-white/80 border border-gray-200 text-xs text-gray-600 hover:bg-white">
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

      <button onClick={capture} disabled={!canProceed} className="btn-primary w-full disabled:opacity-50">
        Apply Signature →
      </button>
    </div>
  );
}

// ─── Document preview with placement highlights ───────────────────────────────

function DocPreview({ pageImages, placements, currentPage }: {
  pageImages: { dataUrl: string; natW: number; natH: number }[];
  placements: Placement[];
  currentPage: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const page = pageImages[currentPage];
  const pagePlacements = placements.filter(p => p.page === currentPage);

  // Scale placements from natural coords to display coords
  const [displayW, setDisplayW] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => setDisplayW(entries[0].contentRect.width));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const scale = displayW > 0 ? displayW / page.natW : 1;

  return (
    <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-border mb-4" style={{ background: '#f5f5f5' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page.dataUrl} alt={`Page ${currentPage + 1}`} className="w-full block" draggable={false} />
      {pagePlacements.map((p, i) => (
        <div
          key={i}
          style={{
            left: p.x * scale, top: p.y * scale,
            width: p.w * scale, height: p.h * scale,
          }}
          className="absolute border-2 border-dashed border-accent rounded bg-accent/10 flex items-center justify-center"
        >
          <span className="text-accent text-xs font-semibold opacity-70">Sign here</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicSignPage() {
  const { token } = useParams<{ token: string }>();

  const [status,     setStatus]     = useState<Status>('loading');
  const [reqData,    setReqData]    = useState<RequestData | null>(null);
  const [pageImages, setPageImages] = useState<{ dataUrl: string; natW: number; natH: number }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [blobUrl,    setBlobUrl]    = useState('');
  const [fileName,   setFileName]   = useState('');
  const [error,      setError]      = useState('');

  useEffect(() => {
    api.requests.get(token)
      .then(async data => {
        setReqData(data);
        if (data.documentType === 'pdf') {
          const pages = await renderPdfAllPages(data.documentData);
          setPageImages(pages);
        } else {
          const img = await loadImage(data.documentData);
          setPageImages([{ dataUrl: data.documentData, natW: img.naturalWidth, natH: img.naturalHeight }]);
        }
        setStatus('ready');
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Already signed')) setStatus('already_signed');
        else { setError(msg); setStatus('error'); }
      });
  }, [token]);

  const handleSign = useCallback(async (sigDataUrl: string) => {
    if (!reqData) return;
    setStatus('signing');
    try {
      // Build composite PDF with all pages
      const pdfDoc = await PDFDocument.create();
      const sigImg = await loadImage(sigDataUrl);

      for (let pageIdx = 0; pageIdx < pageImages.length; pageIdx++) {
        const pageInfo = pageImages[pageIdx];
        const pagePlacements = reqData.placements.filter(p => p.page === pageIdx);

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
      const base64   = btoa(String.fromCharCode(...pdfBytes));
      const signedPdf = `data:application/pdf;base64,${base64}`;

      // Submit to backend
      await api.requests.sign(token, signedPdf);

      // Offer download
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const name = `signed-${reqData.documentName.replace(/\.[^.]+$/, '')}.pdf`;
      setBlobUrl(url);
      setFileName(name);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign document');
      setStatus('error');
    }
  }, [reqData, pageImages, token]);

  // ── Render states ──

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (status === 'already_signed') return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h1 className="text-xl font-bold text-text1 mb-2">Already signed</h1>
        <p className="text-text2 text-sm">This document has already been signed.</p>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-danger/10 border-2 border-danger/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </div>
        <h1 className="text-xl font-bold text-text1 mb-2">Error</h1>
        <p className="text-text2 text-sm">{error || 'This signing link is invalid or has expired.'}</p>
      </div>
    </div>
  );

  if (status === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h1 className="text-xl font-bold text-text1 mb-2">Document signed!</h1>
        <p className="text-text2 text-sm mb-6">Thank you for signing. Download your copy below.</p>
        <a href={blobUrl} download={fileName}
          className="btn-primary flex items-center justify-center gap-2 no-underline mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Download signed PDF
        </a>
      </div>
    </div>
  );

  // status === 'ready' | 'signing'
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <span className="text-base font-bold text-text1">SignEase</span>
            <span className="text-text3 text-xs ml-2">· Signing request</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Info card */}
        <div className="card p-5 mb-6">
          <h1 className="text-lg font-bold text-text1 mb-0.5">You have been asked to sign a document</h1>
          <p className="text-sm font-semibold text-text2 truncate">{reqData?.documentName}</p>
          {reqData?.message && (
            <div className="mt-3 p-3 rounded-xl bg-surface2 border border-border">
              <p className="text-xs text-text3 mb-0.5 font-semibold uppercase tracking-wider">Message</p>
              <p className="text-sm text-text2">{reqData.message}</p>
            </div>
          )}
        </div>

        {/* Page tabs */}
        {pageImages.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {pageImages.map((_, i) => {
              const hasSpots = reqData?.placements.some(p => p.page === i);
              return (
                <button key={i} onClick={() => setCurrentPage(i)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    i === currentPage ? 'bg-accent text-white' : 'bg-surface2 border border-border text-text2 hover:border-accent'
                  }`}>
                  Page {i + 1}{hasSpots ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Document preview */}
        {pageImages.length > 0 && reqData && (
          <DocPreview pageImages={pageImages} placements={reqData.placements} currentPage={currentPage} />
        )}

        {/* Signature pad */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text1 mb-4">Your signature</h2>
          {status === 'signing' ? (
            <div className="flex flex-col items-center gap-3 py-8 text-text2">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Applying your signature…</span>
            </div>
          ) : (
            <SignaturePad onCapture={handleSign} />
          )}
        </div>

        <p className="text-xs text-text3 text-center mt-4">
          By signing, you agree that this is a legally binding electronic signature.
        </p>
      </div>
    </div>
  );
}
