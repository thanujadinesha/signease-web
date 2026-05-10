'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, AdminRequest } from '@/lib/api';

const TIER_BADGE: Record<string, string> = {
  free:      'text-text3 bg-surface2 border-border',
  pro:       'text-accent2 bg-accent/10 border-accent/30',
  premium:   'text-success bg-success/10 border-success/30',
  unlimited: 'text-success bg-success/10 border-success/30',
};

const SLOT_COLORS = ['bg-purple-400','bg-blue-400','bg-green-400','bg-orange-400','bg-pink-400','bg-teal-400'];
function slotBg(slot: number) { return SLOT_COLORS[(slot - 1) % SLOT_COLORS.length]; }

function tierLabel(t: string) {
  return t === 'unlimited' ? 'Premium' : t.charAt(0).toUpperCase() + t.slice(1);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const isComplete = status === 'completed';
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
      isComplete
        ? 'text-success bg-success/10 border-success/30'
        : 'text-accent2 bg-accent/10 border-accent/30'
    }`}>
      {isComplete ? 'Complete' : 'Pending'}
    </span>
  );
}

function SignersExpand({ req }: { req: AdminRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-text3 hover:text-text1 transition-colors">
        <span>{req.signedSlots}/{req.totalSlots} signed</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {req.slots.map(s => (
            <div key={s.slot} className="flex items-center gap-2 text-[11px]">
              <div className={`w-2 h-2 rounded-full shrink-0 ${slotBg(s.slot)}`} />
              <span className="text-text3 truncate max-w-[160px]">{s.email}</span>
              {s.signed_at
                ? <span className="text-success ml-auto shrink-0">✓ {new Date(s.signed_at).toLocaleDateString()}</span>
                : <span className="text-text3 ml-auto shrink-0">waiting</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');

  const load = useCallback(async (s = search, st = status) => {
    setLoading(true);
    try {
      const res = await api.admin.requests({ search: s, status: st, limit: 100 });
      setRequests(res.requests);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(search, status); }, [search, status]);

  const totalPending   = requests.filter(r => r.status !== 'completed').length;
  const totalComplete  = requests.filter(r => r.status === 'completed').length;
  const totalSpots     = requests.reduce((s, r) => s + r.totalPlacements, 0);
  const totalSigned    = requests.reduce((s, r) => s + r.signedSlots, 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text1">Signing Requests</h1>
        <p className="text-text2 text-sm mt-1">All multi-signer requests sent by Pro/Premium users</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests',  value: requests.length, color: 'text-accent' },
          { label: 'Pending',         value: totalPending,    color: 'text-accent2' },
          { label: 'Completed',       value: totalComplete,   color: 'text-success' },
          { label: 'Slots Signed',    value: `${totalSigned} / ${requests.reduce((s, r) => s + r.totalSlots, 0)}`, color: 'text-purple-400' },
          { label: 'Total Sig Spots', value: totalSpots,      color: 'text-orange-400' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <p className="text-xs font-semibold text-text3 uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="search" placeholder="Search document or owner email…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text1 placeholder-text3 focus:outline-none focus:border-accent transition-colors"
        />
        <select
          value={status} onChange={e => setStatus(e.target.value)}
          className="bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text1 focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2">
              {['Document', 'Owner', 'Signers', 'Spots (sig cost)', 'Status', 'Created'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-text3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && requests.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-text3">No requests found</td></tr>
            )}
            {!loading && requests.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors align-top">
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="font-semibold text-text1 truncate">{r.documentName}</p>
                  <p className="text-[11px] text-text3 font-mono mt-0.5">{r.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${r.ownerId}`} className="text-accent2 hover:underline text-xs block truncate max-w-[160px]">
                    {r.ownerEmail}
                  </Link>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${TIER_BADGE[r.ownerTier] ?? ''}`}>
                    {tierLabel(r.ownerTier)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <SignersExpand req={r} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold text-text1 text-base">{r.totalPlacements}</p>
                  <p className="text-[11px] text-text3">
                    {r.totalSlots} signer{r.totalSlots !== 1 ? 's' : ''} ×{' '}
                    {r.totalSlots > 0 ? Math.round(r.totalPlacements / r.totalSlots) : 0} spots each
                  </p>
                  {r.status === 'completed' && (
                    <p className="text-[11px] text-success mt-0.5">−{r.totalPlacements} deducted</p>
                  )}
                  {r.status !== 'completed' && (
                    <p className="text-[11px] text-text3 mt-0.5">pending deduction</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                  <div className="mt-2 h-1.5 w-20 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${r.status === 'completed' ? 'bg-success' : 'bg-accent'}`}
                      style={{ width: `${r.totalSlots > 0 ? Math.round((r.signedSlots / r.totalSlots) * 100) : 0}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-text3 text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
