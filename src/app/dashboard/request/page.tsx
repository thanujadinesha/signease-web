'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'document' | 'mark' | 'recipients' | 'done';

interface Placement {
  x: number; y: number; w: number; h: number;
  page: number; pageW: number; pageH: number; slot: number;
}

interface Signer { slot: number; label: string; email: string }

interface DocInfo {
  file: File;
  dataUrl: string;
  pageImages: { dataUrl: string; natW: number; natH: number }[];
  type: 'pdf' | 'image';
}

// ─── Slot colors (up to 6 signers) ───────────────────────────────────────────

const SLOT_COLORS = [
  { border: 'border-purple-400', bg: 'bg-purple-400/15', text: 'text-purple-400', solid: 'bg-purple-400', tab: 'bg-purple-400 text-white', tabOff: 'border-purple-400/50 text-purple-400' },
  { border: 'border-blue-400',   bg: 'bg-blue-400/15',   text: 'text-blue-400',   solid: 'bg-blue-400',   tab: 'bg-blue-400 text-white',   tabOff: 'border-blue-400/50 text-blue-400' },
  { border: 'border-green-400',  bg: 'bg-green-400/15',  text: 'text-green-400',  solid: 'bg-green-400',  tab: 'bg-green-400 text-white',  tabOff: 'border-green-400/50 text-green-400' },
  { border: 'border-orange-400', bg: 'bg-orange-400/15', text: 'text-orange-400', solid: 'bg-orange-400', tab: 'bg-orange-400 text-white', tabOff: 'border-orange-400/50 text-orange-400' },
  { border: 'border-pink-400',   bg: 'bg-pink-400/15',   text: 'text-pink-400',   solid: 'bg-pink-400',   tab: 'bg-pink-400 text-white',   tabOff: 'border-pink-400/50 text-pink-400' },
  { border: 'border-teal-400',   bg: 'bg-teal-400/15',   text: 'text-teal-400',   solid: 'bg-teal-400',   tab: 'bg-teal-400 text-white',   tabOff: 'border-teal-400/50 text-teal-400' },
];

function slotColor(slot: number) { return SLOT_COLORS[(slot - 1) % SLOT_COLORS.length]; }

// ─── Step bar ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Document', 'Mark Spots', 'Recipients', 'Done'];
const STEP_IDX: Record<Step, number> = { document: 0, mark: 1, recipients: 2, done: 3 };

function StepBar({ current }: { current: Step }) {
  const idx = STEP_IDX[current];
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 ${i <= idx ? 'text-accent' : 'text-text3'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i < idx ? 'bg-accent border-accent text-white' : i === idx ? 'border-accent text-accent' : 'border-border text-text3'
            }`}>{i + 1}</div>
            <span className="text-xs font-medium hidden sm:block">{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className={`flex-1 h-px mx-2 ${i < idx ? 'bg-accent' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function renderAllPages(file: File) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
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
      const dataUrl = await fileToBase64(file);
      const isPdf   = file.type === 'application/pdf';
      const pageImages = isPdf
        ? await renderAllPages(file)
        : await (async () => {
            const img = await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; });
            return [{ dataUrl, natW: img.naturalWidth, natH: img.naturalHeight }];
          })();
      setDoc({ file, dataUrl, pageImages, type: isPdf ? 'pdf' : 'image' });
    } catch (err) { setError(`Failed to load: ${err instanceof Error ? err.message : String(err)}`); }
    setLoading(false);
  }

  const fmt = (b: number) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} KB`;

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Upload document</h2>
      <p className="text-text2 text-sm mb-6">Upload the document that multiple people need to sign</p>

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
      <button onClick={() => doc && onNext(doc)} disabled={!doc || loading} className="btn-primary mt-6 w-full disabled:opacity-50">
        Next: Mark Signature Spots →
      </button>
    </div>
  );
}

// ─── Step 2: Mark spots with signer assignment ────────────────────────────────

function MarkStep({ doc, onNext, onBack }: {
  doc: DocInfo;
  onNext: (placements: Placement[], signers: Signer[]) => void;
  onBack: () => void;
}) {
  const [signers,     setSigners]     = useState<Signer[]>([{ slot: 1, label: 'Person 1', email: '' }]);
  const [activeSlot,  setActiveSlot]  = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [placements,  setPlacements]  = useState<Placement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef      = useRef<{ idx: number; ox: number; oy: number } | null>(null);
  const resizeRef    = useRef<{ idx: number; sx: number; sy: number; iw: number; ih: number } | null>(null);

  const page = doc.pageImages[currentPage];

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
    const cw = el?.offsetWidth ?? 400; const ch = el?.offsetHeight ?? 400;
    setPlacements(prev => [...prev, {
      x: Math.max(0, cw / 2 - 80), y: Math.max(0, ch / 2 - 30),
      w: 160, h: 60,
      page: currentPage, pageW: page.natW, pageH: page.natH,
      slot: activeSlot,
    }]);
  }

  function addSigner() {
    if (signers.length >= 6) return;
    const slot = signers.length + 1;
    setSigners(prev => [...prev, { slot, label: `Person ${slot}`, email: '' }]);
    setActiveSlot(slot);
  }

  function removeSigner(slot: number) {
    if (signers.length <= 1) return;
    setSigners(prev => prev.filter(s => s.slot !== slot));
    setPlacements(prev => prev.filter(p => p.slot !== slot));
    setActiveSlot(signers.find(s => s.slot !== slot)?.slot ?? 1);
  }

  function updateSignerLabel(slot: number, label: string) {
    setSigners(prev => prev.map(s => s.slot === slot ? { ...s, label } : s));
  }

  function startDrag(e: React.MouseEvent, idx: number) {
    e.preventDefault();
    const p = placements[idx];
    dragRef.current = { idx, ox: e.clientX - p.x, oy: e.clientY - p.y };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { idx: i, ox, oy } = dragRef.current;
      setPlacements(prev => prev.map((item, ii) => ii === i ? clampP({ ...item, x: ev.clientX - ox, y: ev.clientY - oy }) : item));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }

  function startResize(e: React.MouseEvent, idx: number) {
    e.preventDefault(); e.stopPropagation();
    const p = placements[idx];
    resizeRef.current = { idx, sx: e.clientX, sy: e.clientY, iw: p.w, ih: p.h };
    const move = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const { idx: i, sx, sy, iw, ih } = resizeRef.current;
      setPlacements(prev => prev.map((item, ii) => ii === i ? clampP({ ...item, w: Math.max(60, iw + ev.clientX - sx), h: Math.max(24, ih + ev.clientY - sy) }) : item));
    };
    const up = () => { resizeRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }

  function scaledPlacements(): Placement[] {
    const el = containerRef.current;
    if (!el) return placements;
    const dw = el.offsetWidth;
    return placements.map(p => {
      const pg = doc.pageImages[p.page];
      const sc = pg.natW / dw;
      return { ...p, x: p.x * sc, y: p.y * sc, w: p.w * sc, h: p.h * sc, pageW: pg.natW, pageH: pg.natH };
    });
  }

  const pagePlacements = placements.filter(p => p.page === currentPage);

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Mark signature spots</h2>
      <p className="text-text2 text-sm mb-4">Add signers, then mark where each person should sign. Signers will be notified in order.</p>

      {/* Signer tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {signers.map(s => {
          const c = slotColor(s.slot);
          const active = s.slot === activeSlot;
          return (
            <button key={s.slot} onClick={() => setActiveSlot(s.slot)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                active ? c.tab : `bg-surface border ${c.tabOff}`
              }`}>
              <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : c.solid}`} />
              {s.label}
              {placements.filter(p => p.slot === s.slot).length > 0 && (
                <span className={`ml-0.5 ${active ? 'opacity-80' : ''}`}>
                  ({placements.filter(p => p.slot === s.slot).length})
                </span>
              )}
              {signers.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); removeSigner(s.slot); }}
                  className="ml-0.5 hover:opacity-60 cursor-pointer"
                >×</span>
              )}
            </button>
          );
        })}
        {signers.length < 6 && (
          <button onClick={addSigner}
            className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-border text-text3 hover:border-accent hover:text-accent transition-colors">
            + Add signer
          </button>
        )}
      </div>

      {/* Edit active signer label */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs text-text3 shrink-0">Label for selected signer:</label>
        <input
          value={signers.find(s => s.slot === activeSlot)?.label ?? ''}
          onChange={e => updateSignerLabel(activeSlot, e.target.value)}
          className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-1.5 text-xs text-text1 focus:outline-none focus:border-accent transition-colors"
          placeholder="e.g. CEO, Client, Witness…"
        />
      </div>

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

      {/* Document with overlaid spots */}
      <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-border mb-4 select-none" style={{ background: '#f5f5f5' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.dataUrl} alt={`Page ${currentPage + 1}`} className="w-full block" draggable={false} />

        {pagePlacements.map(p => {
          const globalIdx = placements.indexOf(p);
          const c = slotColor(p.slot);
          const signer = signers.find(s => s.slot === p.slot);
          const isActive = p.slot === activeSlot;
          return (
            <div
              key={globalIdx}
              onMouseDown={e => startDrag(e, globalIdx)}
              style={{ left: p.x, top: p.y, width: p.w, height: p.h, opacity: isActive ? 1 : 0.5 }}
              className={`absolute border-2 rounded cursor-move ${c.border} ${c.bg}`}
            >
              <div className="w-full h-full flex items-center justify-center pointer-events-none">
                <span className={`text-[10px] font-bold ${c.text}`}>{signer?.label ?? `P${p.slot}`}</span>
              </div>
              <button
                onMouseDown={e => { e.stopPropagation(); setPlacements(prev => prev.filter((_, i) => i !== globalIdx)); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center z-10 pointer-events-auto hover:opacity-80"
              >×</button>
              <div onMouseDown={e => startResize(e, globalIdx)} className={`absolute bottom-0 right-0 w-4 h-4 ${c.solid} rounded-tl cursor-se-resize`} />
            </div>
          );
        })}
      </div>

      {/* Add spot button */}
      {(() => { const c = slotColor(activeSlot); const signer = signers.find(s => s.slot === activeSlot);
        return (
          <button onClick={addPlacement}
            className={`w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold hover:opacity-80 transition-opacity mb-4 ${c.border} ${c.text}`}>
            + Add spot for {signer?.label ?? `Person ${activeSlot}`} on this page
          </button>
        );
      })()}

      {/* Summary */}
      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold text-text3 uppercase tracking-wider mb-2">Signing order summary</p>
        <div className="space-y-2">
          {signers.map((s, i) => {
            const c = slotColor(s.slot);
            const count = placements.filter(p => p.slot === s.slot).length;
            return (
              <div key={s.slot} className="flex items-center gap-3">
                <span className="text-xs text-text3 w-4">{i + 1}.</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.solid}`} />
                <span className="text-sm text-text1 flex-1">{s.label}</span>
                <span className="text-xs text-text3">{count} spot{count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">← Back</button>
        <button onClick={() => placements.length > 0 && onNext(scaledPlacements(), signers)} disabled={placements.length === 0}
          className="flex-[2] btn-primary disabled:opacity-50">
          Next: Assign Emails →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Recipients ───────────────────────────────────────────────────────

function RecipientsStep({ doc, placements, signers: initialSigners, onDone, onBack }: {
  doc: DocInfo;
  placements: Placement[];
  signers: Signer[];
  onDone: (requestId: string) => void;
  onBack: () => void;
}) {
  const [signers,  setSigners]  = useState<Signer[]>(initialSigners);
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  function updateEmail(slot: number, email: string) {
    setSigners(prev => prev.map(s => s.slot === slot ? { ...s, email } : s));
  }

  async function handleSubmit() {
    for (const s of signers) {
      if (!s.email.trim() || !s.email.includes('@')) {
        setError(`Please enter a valid email for ${s.label}`); return;
      }
    }
    setLoading(true); setError('');
    try {
      const res = await api.requests.create({
        documentName: doc.file.name,
        documentData: doc.dataUrl,
        documentType: doc.type,
        message: message.trim() || undefined,
        placements,
        signers: signers.map(s => ({ slot: s.slot, email: s.email.trim(), label: s.label })),
      });
      onDone(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    }
    setLoading(false);
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text1 mb-1">Assign recipients</h2>
      <p className="text-text2 text-sm mb-6">Enter the email for each signer. They will be notified in the order listed below.</p>

      <div className="space-y-3 mb-4">
        {signers.map((s, i) => {
          const c = slotColor(s.slot);
          const spotCount = placements.filter(p => p.slot === s.slot).length;
          return (
            <div key={s.slot} className={`card p-4 border ${c.border}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${c.solid}`}>{i + 1}</div>
                <span className="text-sm font-semibold text-text1">{s.label}</span>
                <span className="text-xs text-text3 ml-auto">{spotCount} spot{spotCount !== 1 ? 's' : ''}</span>
              </div>
              <input
                type="email"
                value={s.email}
                onChange={e => updateEmail(s.slot, e.target.value)}
                placeholder={`${s.label.toLowerCase().replace(/\s/g, '.')}@example.com`}
                className="w-full bg-surface2 border border-border rounded-xl px-3 py-2.5 text-sm text-text1 placeholder-text3 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          );
        })}
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Message (optional)</label>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Please review and sign this document…"
          rows={3}
          className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm text-text1 placeholder-text3 focus:outline-none focus:border-accent transition-colors resize-none"
        />
      </div>

      <div className="card p-4 mb-6 border-accent/20 bg-accent/5">
        <p className="text-xs text-text2">
          <span className="font-semibold text-accent">How it works:</span> An email will be sent to{' '}
          <strong>{signers[0]?.label}</strong> first. After they sign, the next person is automatically notified, and so on.
          Once all {signers.length} people have signed, you will receive a notification to download the completed document.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-border text-text2 text-sm hover:border-accent hover:text-text1 transition-colors">← Back</button>
        <button onClick={handleSubmit} disabled={loading} className="flex-[2] btn-primary disabled:opacity-50">
          {loading ? 'Sending…' : `Send to ${signers[0]?.label} →`}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function DoneStep({ requestId, signers }: { requestId: string; signers: Signer[] }) {
  return (
    <div>
      <div className="card p-8 text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 className="text-xl font-bold text-text1 mb-2">Signing request sent!</h2>
        <p className="text-text2 text-sm">An email has been sent to <strong>{signers[0]?.label}</strong>. The next person will be notified automatically after each signature.</p>
      </div>

      <div className="card p-5 mb-5">
        <p className="text-xs font-semibold text-text3 uppercase tracking-wider mb-3">Signing order</p>
        <div className="space-y-2.5">
          {signers.map((s, i) => {
            const c = slotColor(s.slot);
            return (
              <div key={s.slot} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${c.solid}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text1">{s.label}</p>
                  <p className="text-xs text-text3 truncate">{s.email}</p>
                </div>
                {i === 0 && <span className="text-xs font-semibold text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded-full">Notified</span>}
                {i > 0 && <span className="text-xs text-text3">Waiting</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Link href={`/dashboard/requests/${requestId}`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-text2 text-sm font-semibold hover:border-accent hover:text-text1 transition-colors">
          Track signing progress
        </Link>
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
  const [signers,    setSigners]    = useState<Signer[]>([]);
  const [requestId,  setRequestId]  = useState('');

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text2 hover:border-accent transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </div>
          <span className="text-base font-bold text-text1 flex-1">Request Signatures</span>
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
        {step === 'document' && <DocStep onNext={d => { setDoc(d); setStep('mark'); }} />}
        {step === 'mark' && doc && (
          <MarkStep doc={doc} onNext={(p, s) => { setPlacements(p); setSigners(s); setStep('recipients'); }} onBack={() => setStep('document')} />
        )}
        {step === 'recipients' && doc && (
          <RecipientsStep doc={doc} placements={placements} signers={signers}
            onDone={id => { setRequestId(id); setStep('done'); }} onBack={() => setStep('mark')} />
        )}
        {step === 'done' && <DoneStep requestId={requestId} signers={signers} />}
      </div>
    </div>
  );
}

export default function RequestPage() {
  return <AuthGuard><RequestContent /></AuthGuard>;
}
