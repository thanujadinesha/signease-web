'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

type RequestRow = {
  id: string; documentName: string; status: string;
  currentSlot: number; totalSlots: number; createdAt: string;
  expiresAt: string | null; reminderInterval: number | null;
  slots: { slot: number; label: string; email: string; signed_at: string | null }[];
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RequestCard({ r }: { r: RequestRow }) {
  const signedCount = r.slots.filter(s => s.signed_at).length;
  const pct = r.totalSlots > 0 ? Math.round((signedCount / r.totalSlots) * 100) : 0;
  const isComplete = r.status === 'completed';
  const isExpired  = r.status === 'expired';

  function statusBadge() {
    if (isComplete) return { label: 'Complete',                  cls: 'text-success bg-success/10 border-success/30' };
    if (isExpired)  return { label: 'Expired',                   cls: 'text-danger bg-danger/10 border-danger/30' };
    return              { label: `${signedCount}/${r.totalSlots} signed`, cls: 'text-accent2 bg-accent/10 border-accent/30' };
  }
  const badge = statusBadge();

  return (
    <Link href={`/dashboard/requests/${r.id}`} className="card p-5 block hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text1 truncate">{r.documentName}</p>
          <p className="text-xs text-text3 mt-0.5">{fmtDate(r.createdAt)}</p>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-border overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>

      {/* Signers */}
      <div className="flex flex-wrap gap-1.5">
        {r.slots.map(s => (
          <span key={s.slot} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
            s.signed_at ? 'text-success bg-success/10 border-success/30' : 'text-text3 bg-surface2 border-border'
          }`}>
            {s.signed_at ? '✓' : '○'} {s.label}
          </span>
        ))}
      </div>
    </Link>
  );
}

function RequestsContent() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.requests.list()
      .then(r => setRequests(r.requests))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text2 hover:border-accent transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <span className="text-base font-bold text-text1 flex-1">My Signing Requests</span>
          <Link href="/dashboard/request" className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors">
            + New request
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text3 mb-4">No signing requests yet</p>
            <Link href="/dashboard/request" className="btn-primary inline-block">Create your first request</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(r => <RequestCard key={r.id} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RequestsPage() {
  return <AuthGuard><RequestsContent /></AuthGuard>;
}
