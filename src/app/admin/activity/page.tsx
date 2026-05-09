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

export default function AdminActivityPage() {
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.admin.activity(100)
      .then(res => setActivity(res.activity))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text1">Activity</h1>
        <p className="text-text2 text-sm mt-1">Last 100 signing events across all users</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2">
              {['Document', 'User', 'Plan', 'Signed at'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-bold text-text3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="text-center py-12">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && activity.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-sm text-text3">No activity yet</td></tr>
            )}
            {!loading && activity.map(a => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <span className="text-text1 font-medium truncate max-w-[220px]">{a.document_name || 'document'}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${a.user_id}`} className="text-accent2 hover:underline text-xs truncate max-w-[180px] block">
                    {a.email}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${TIER_BADGE[a.tier] ?? ''}`}>
                    {a.tier === 'unlimited' ? 'premium' : a.tier}
                  </span>
                </td>
                <td className="px-5 py-3 text-text3 text-xs">
                  {new Date(a.signed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
