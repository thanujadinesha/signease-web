'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'document' | 'mark' | 'recipient' | 'share';

interface Placement {
  x: number; y: number; w: number; h: number;
  page: number; pageW: number; pageH: number;
}

interface DocInfo {
  file: File;
  dataUrl: string;   // base64 of the document (PDF or image)
  pageImages: { dataUrl: string; natW: number; natH: number }[];
  type: 'pdf' | 'image';
}

// ─── Step bar ─────────────────────────────────────────────────────────────────

const STEPS = ['Document', 'Mark Spots', 'Recipient', 'Share Link'];

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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
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
      const dataUrl = await fileToBase64(file);
      if (isPdf) {
        const pageImages = await renderAllPages(file);
        setDoc({ file, dataUrl, pageImages, type: 'pdf' });
      } else {
        const img = await new Promise<HTMLImageElement>(res => {
          const i = new Image(); i.onload = () => res(i); i.src = dataUrl;
        });
        setDoc({ file, dataUrl, pageImages: [{ dataUrl, natW: img.naturalWidth, natH: img.naturalHeight }], type: 'image' });
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
      <p className="text-text2 text-sm mb-6">Upload the document you want someone else to sign</p>

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
              <div className="w-12 h-12 rounded-2xl bg-purple-400/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
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
          <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text1 truncate">{doc.file.name}</p>
            <p className="text-xs text-text3">{fmt(doc.file.size)} · {doc.pageImages.length} page{doc.pageImages.length !== 1 ? 's' : ''}</p>
          </div>
          <svg className="w-5 h-5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
      )}

      <button onClick={() => doc && onNext(doc)} disabled={!doc || loading} className="btn-primary mt-6 w-full">
        Next: Mark Sign Spots →
      </button>
    </div>
  );
}

// ─── Step 2: Mark Spots ───────────────────────────────────────────────────────

function MarkStep({
  doc, onNext, onBack,
}: { doc: DocInfo; onNext: (placements: Placement[]) => void; onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [placements,  setPlacements]  = useState<Placement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which placement is being dragged/resized
  const dragRef   = useRef<{ idx: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ idx: number; startX: number; startY: number; initW: number; initH: number } | null>(null);

  const page = doc.pageImages[currentPage];
  const pagePlacements = placements.filter(p => p.page === currentPage);

  function clampPlacement(p: Placement): Placement {
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

  function addPlacement() {
    const el = containerRef.current;
    const cw = el?.offsetWidth ?? 400;
    const ch = el?.offsetHeight ?? 400;
    const newP: Placement = {
      x: Math.max(0, cw / 2 - 80), y: Math.max(0, ch / 2 - 30),
      w: 160, h: 60,
      page: currentPage,
      pageW: page.natW, pageH: page.natH,
    };
    setPlacements(prev => [...prev, newP]);
  }

  function removePlacement(idx: number) {
    // idx is global index in placements array
    setPlacements(prev => prev.filter((_, i) => i !== idx));
  }

  function startDrag(e: React.MouseEvent, globalIdx: number) {
    e.preventDefault();
    const p = placements[globalIdx];
    dragRef.current = { idx: globalIdx, ox: e.clientX - p.x, oy: e.clientY - p.y };
    function move(ev: MouseEvent) {
      if (!dragRef.current) return;
      const { idx, ox, oy } = dragRef.current;
      setPlacements(prev => prev.map((item, i) =>
        i === idx ? clampPlacement({ ...item, x: ev.clientX - ox, y: ev.clientY - oy }) : item
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
        i === idx ? clampPlacement({ ...item, w: Math.max(60, initW + ev.clientX - startX), h: Math.max(24, initH + ev.clientY - startY) }) : item
      ));
    }
    function up() { resizeRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // Scale placements relative to natural page size for storage
  function scaledPlacements(): Placement[] {
    const el = containerRef.current;
    if (!el) return placements;
    const displayW = el.offsetWidth;
    return placements.map(p => {
      const pageImg = doc.pageImages[p.page];
      const scale = pageImg.natW / displayW;
      return {
        ...p,
        x: p.x * scale, y: p.y * scale,
        w: p.w * scale, h: p.h * scale,
        pageW: pageImg.natW, pageH: pageImg.natH,
      };
    });
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Mark signature spots</h2>
      <p className="text-text2 text-sm mb-4">
        Add spots where the recipient should sign. You can add multiple spots per page.
      </p>

      {/* Page tabs */}
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
              className="absolute border-2 border-purple-400 rounded cursor-move bg-purple-400/10"
            >
              <div className="w-full h-full flex items-center justify-center pointer-events-none">
                <span className="text-purple-400 text-xs font-semibold opacity-60">Sign here</span>
              </div>
              <button
                onMouseDown={e => { e.stopPropagation(); removePlacement(globalIdx); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center hover:opacity-80 transition-opacity z-10 pointer-events-auto"
              >
                ×
              </button>
              <div onMouseDown={e => startResize(e, globalIdx)} className="absolute bottom-0 right-0 w-4 h-4 bg-purple-400 rounded-tl cursor-se-resize" />
            </div>
          );
        })}
      </div>

      <button onClick={addPlacement}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-purple-400/50 text-purple-400 text-sm font-semibold hover:border-purple-400 transition-colors mb-6">
        + Add signature spot on this page
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 text-sm text-text2">
          {placements.length === 0
            ? 'No spots added yet'
            : `${placements.length} spot${placements.length !== 1 ? 's' : ''} across ${new Set(placements.map(p => p.page)).size} page${new Set(placements.map(p => p.page)).size !== 1 ? 's' : ''}`}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
          ← Back
        </button>
        <button onClick={() => onNext(scaledPlacements())} disabled={placements.length === 0}
          className="flex-[2] btn-primary disabled:opacity-50">
          Next: Recipient Info →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Recipient ────────────────────────────────────────────────────────

function RecipientStep({
  doc, placements, onNext, onBack,
}: { doc: DocInfo; placements: Placement[]; onNext: (token: string) => void; onBack: () => void }) {
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit() {
    if (!email.trim()) { setError('Recipient email is required'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.requests.create({
        documentName: doc.file.name,
        documentData: doc.dataUrl,
        documentType: doc.type,
        recipientEmail: email.trim(),
        message: message.trim() || undefined,
        placements,
      });
      onNext(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signing request');
    }
    setLoading(false);
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Recipient details</h2>
      <p className="text-text2 text-sm mb-6">Who needs to sign this document?</p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-text2 mb-1.5">Recipient email *</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="signer@example.com"
            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm text-text1 placeholder-text3 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text2 mb-1.5">Message (optional)</label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Please sign this document…"
            rows={3}
            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm text-text1 placeholder-text3 focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">
          ← Back
        </button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex-[2] btn-primary disabled:opacity-50">
          {loading ? 'Creating link…' : 'Create Signing Link →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Share Link ────────────────────────────────────────────────────────

function ShareStep({ token }: { token: string }) {
  const BASE = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const url  = `${BASE}/sign/${token}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="card p-8 text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 className="text-xl font-bold text-text1 mb-1">Signing link created!</h2>
        <p className="text-text2 text-sm">Share this link with your recipient so they can sign the document.</p>
      </div>

      <div className="card p-4 mb-4">
        <p className="text-xs font-semibold text-text3 uppercase tracking-wider mb-2">Signing link</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-accent2 font-mono break-all">{url}</p>
          <button onClick={copy}
            className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text2 hover:border-accent hover:text-text1 transition-colors">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <a href={`mailto:?subject=Please%20sign%20this%20document&body=Hi%2C%20please%20sign%20this%20document%3A%20${encodeURIComponent(url)}`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-text2 text-sm font-semibold hover:border-accent hover:text-text1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          Open in email
        </a>
        <Link href="/dashboard" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

// ─── Page root ─────────────────────────────────────────────────────────────────

function RequestContent() {
  const { user } = useAuth();
  const [step,       setStep]       = useState<Step>('document');
  const [doc,        setDoc]        = useState<DocInfo | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [token,      setToken]      = useState('');

  const stepIdx: Record<Step, number> = { document: 0, mark: 1, recipient: 2, share: 3 };

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text2 hover:border-accent transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="text-base font-bold text-text1 flex-1">Request Signature</span>
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

        {step === 'document' && (
          <DocStep onNext={d => { setDoc(d); setStep('mark'); }} />
        )}
        {step === 'mark' && doc && (
          <MarkStep doc={doc} onNext={p => { setPlacements(p); setStep('recipient'); }} onBack={() => setStep('document')} />
        )}
        {step === 'recipient' && doc && (
          <RecipientStep doc={doc} placements={placements} onNext={t => { setToken(t); setStep('share'); }} onBack={() => setStep('mark')} />
        )}
        {step === 'share' && <ShareStep token={token} />}
      </div>
    </div>
  );
}

export default function RequestPage() {
  return <AuthGuard><RequestContent /></AuthGuard>;
}
