'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, AdminActivity } from '@/lib/api';

const TIER_BADGE: Record<string, string> = {
  free:      'text-text3 bg-surface2 border-border',
  pro:       'text-accent2 bg-accent/10 border-accent/30',
  premium:   'text-success bg-success/10 border-success/30',
  unlimited: 'text-success bg-success/10 border-success/30',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminActivityPage() {
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'all' | 'quick_sign' | 'slot_signed'>('all');

  useEffect(() => {
    api.admin.activity(200)
      .then(res => setActivity(res.activity))
      .finally(() => setLoading(false));
  }, []);

  const visible = filter === 'all' ? activity : activity.filter(a => a.type === filter);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text1">Activity</h1>
          <p className="text-text2 text-sm mt-1">All signing events across the platform</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'quick_sign', 'slot_signed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                filter === f
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-text2 hover:border-accent'
              }`}>
              {f === 'all' ? 'All' : f === 'quick_sign' ? 'Quick Sign' : 'Multi-Sign'}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2">
              {['Type', 'Document', 'Owner', 'Signer / Detail', 'Plan', 'Signed at'].map(h => (
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
            {!loading && visible.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-text3">No activity yet</td></tr>
            )}
            {!loading && visible.map(a => (
              <tr key={a.id + a.type} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors">
                <td className="px-4 py-3 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                    a.type === 'slot_signed'
                      ? 'text-orange-400 bg-orange-400/10 border-orange-400/30'
                      : 'text-blue-400 bg-blue-400/10 border-blue-400/30'
                  }`}>
                    {a.type === 'slot_signed' ? 'Multi-Sign' : 'Quick Sign'}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[180px]">
                  <span className="text-text1 font-medium truncate block">{a.document_name || 'document'}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${a.user_id}`} className="text-accent2 hover:underline text-xs block truncate max-w-[160px]">
                    {a.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-text3">
                  {a.type === 'slot_signed' && a.slotInfo ? (
                    <div>
                      <p className="text-text2 font-medium truncate max-w-[180px]">{a.signer_email}</p>
                      <p className="text-[10px]">{a.slotInfo.label} · slot {a.slotInfo.slot}/{a.slotInfo.totalSlots}</p>
                    </div>
                  ) : (
                    <span className="text-text3">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${TIER_BADGE[a.tier] ?? ''}`}>
                    {a.tier === 'unlimited' ? 'premium' : a.tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-text3 text-xs whitespace-nowrap">{fmtDate(a.signed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
