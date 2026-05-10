'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PDFDocument } from 'pdf-lib';
import AuthGuard from '@/components/AuthGuard';

type SlotRow = { slot: number; label: string; email: string; signed_at: string | null; signature_data: string | null };

type RequestDetail = {
  id: string; documentName: string; documentData: string; documentType: string;
  placements: { x: number; y: number; w: number; h: number; page: number; pageW: number; pageH: number; slot: number }[];
  status: string; currentSlot: number; totalSlots: number; createdAt: string;
  slots: SlotRow[];
};

// ─── Colors ───────────────────────────────────────────────────────────────────

const SLOT_SOLID = ['bg-purple-400','bg-blue-400','bg-green-400','bg-orange-400','bg-pink-400','bg-teal-400'];
function slotBg(slot: number) { return SLOT_SOLID[(slot - 1) % SLOT_SOLID.length]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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

// ─── Download composite ───────────────────────────────────────────────────────

function DownloadButton({ detail }: { detail: RequestDetail }) {
  const [generating, setGenerating] = useState(false);
  const [blobUrl,    setBlobUrl]    = useState('');
  const [fileName,   setFileName]   = useState('');

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const pages = detail.documentType === 'pdf'
        ? await renderPdfAllPages(detail.documentData)
        : await (async () => {
            const img = await loadImage(detail.documentData);
            return [{ dataUrl: detail.documentData, natW: img.naturalWidth, natH: img.naturalHeight }];
          })();

      const completedSlots = detail.slots.filter(s => s.signed_at && s.signature_data);
      const pdfDoc = await PDFDocument.create();

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const pageInfo = pages[pageIdx];
        const canvas = document.createElement('canvas');
        canvas.width = pageInfo.natW; canvas.height = pageInfo.natH;
        const ctx = canvas.getContext('2d')!;

        // Draw document page
        ctx.drawImage(await loadImage(pageInfo.dataUrl), 0, 0);

        // Draw each signer's signature at their placements (in slot order)
        for (const slot of completedSlots.sort((a, b) => a.slot - b.slot)) {
          const sigImg = await loadImage(slot.signature_data!);
          const spotsOnPage = detail.placements.filter(p => p.slot === slot.slot && p.page === pageIdx);
          for (const p of spotsOnPage) {
            ctx.drawImage(sigImg, p.x, p.y, p.w, p.h);
          }
        }

        const composited = canvas.toDataURL('image/png');
        const pngBytes   = await fetch(composited).then(r => r.arrayBuffer());
        const pngImage   = await pdfDoc.embedPng(pngBytes);
        const pdfPage    = pdfDoc.addPage([pageInfo.natW, pageInfo.natH]);
        pdfPage.drawImage(pngImage, { x: 0, y: 0, width: pageInfo.natW, height: pageInfo.natH });
      }

      const pdfBytes = await pdfDoc.save();
      // Chunked btoa to avoid call stack overflow on large PDFs
      let binary = '';
      for (let i = 0; i < pdfBytes.length; i += 8192) {
        binary += String.fromCharCode(...pdfBytes.subarray(i, i + 8192));
      }
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      setBlobUrl(URL.createObjectURL(blob));
      setFileName(`signed-${detail.documentName.replace(/\.[^.]+$/, '')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF. Please try again.');
    }
    setGenerating(false);
  }, [detail]);

  if (blobUrl) {
    return (
      <a href={blobUrl} download={fileName}
        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-success text-white font-semibold hover:bg-success/90 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        Download signed PDF
      </a>
    );
  }

  return (
    <button onClick={generate} disabled={generating}
      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-success text-white font-semibold hover:bg-success/90 transition-colors disabled:opacity-60">
      {generating ? (
        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
      ) : (
        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download signed PDF</>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RequestDetailContent() {
  const { id }  = useParams<{ id: string }>();
  const [detail,  setDetail]  = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function fetchDetail() {
    api.requests.getById(id)
      .then(d => {
        setDetail(d);
        // Stop polling once complete
        if (d.status === 'completed' && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchDetail();
    // Poll every 15s while pending
    intervalRef.current = setInterval(fetchDetail, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error)  return <div className="p-8 text-danger">{error}</div>;
  if (!detail) return null;

  const signedCount = detail.slots.filter(s => s.signed_at).length;
  const isComplete  = detail.status === 'completed';
  const pct = detail.totalSlots > 0 ? Math.round((signedCount / detail.totalSlots) * 100) : 0;

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard/requests" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text2 hover:border-accent transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <span className="text-base font-bold text-text1 flex-1 truncate">{detail.documentName}</span>
          {isComplete && <DownloadButton detail={detail} />}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Status banner */}
        <div className={`card p-5 mb-6 ${isComplete ? 'border-success/30 bg-success/5' : 'border-accent/20 bg-accent/5'}`}>
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className={`font-bold text-lg ${isComplete ? 'text-success' : 'text-text1'}`}>
                {isComplete ? 'All signatures complete' : `Awaiting ${detail.totalSlots - signedCount} more signature${detail.totalSlots - signedCount !== 1 ? 's' : ''}`}
              </h2>
              <p className="text-xs text-text3 mt-0.5">Created {fmtDate(detail.createdAt)}</p>
            </div>
            <span className={`text-2xl font-bold ${isComplete ? 'text-success' : 'text-accent'}`}>
              {signedCount}/{detail.totalSlots}
            </span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
          </div>
          {!isComplete && (
            <p className="text-xs text-text3 mt-2">This page refreshes automatically every 15 seconds.</p>
          )}
        </div>

        {/* Signers detail */}
        <div className="card overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-text1">Signing order & status</h3>
          </div>
          <div className="divide-y divide-border">
            {detail.slots.map((s, i) => {
              const signed  = !!s.signed_at;
              const isCurrent = !signed && s.slot === detail.currentSlot;
              const isWaiting = !signed && s.slot > detail.currentSlot;
              return (
                <div key={s.slot} className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white ${slotBg(s.slot)}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text1">{s.label}</p>
                    <p className="text-xs text-text3 truncate">{s.email}</p>
                    {signed && <p className="text-xs text-success mt-0.5">Signed {fmtDate(s.signed_at)}</p>}
                  </div>
                  <div className="shrink-0">
                    {signed     && <span className="text-xs font-bold text-success bg-success/10 border border-success/30 px-2.5 py-1 rounded-full">Signed</span>}
                    {isCurrent  && <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/30 px-2.5 py-1 rounded-full">Notified</span>}
                    {isWaiting  && <span className="text-xs font-bold text-text3 bg-surface2 border border-border px-2.5 py-1 rounded-full">Waiting</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spots summary */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text1 mb-3">Signature spots</h3>
          <div className="space-y-2">
            {detail.slots.map(s => {
              const count = detail.placements.filter(p => p.slot === s.slot).length;
              const pages = [...new Set(detail.placements.filter(p => p.slot === s.slot).map(p => p.page + 1))];
              return (
                <div key={s.slot} className="flex items-center gap-3 text-sm">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${slotBg(s.slot)}`} />
                  <span className="text-text2 flex-1">{s.label}</span>
                  <span className="text-text3 text-xs">{count} spot{count !== 1 ? 's' : ''}{pages.length > 0 ? ` on page${pages.length !== 1 ? 's' : ''} ${pages.join(', ')}` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isComplete && (
          <div className="mt-6 flex justify-center">
            <DownloadButton detail={detail} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function RequestDetailPage() {
  return <AuthGuard><RequestDetailContent /></AuthGuard>;
}
