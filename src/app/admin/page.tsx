'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Stats = {
  totalUsers: number; totalSignatures: number; totalDocuments: number;
  signaturesThisWeek: number;
  tierBreakdown: { tier: string; count: number }[];
  totalRequests: number; totalSlotsCompleted: number; totalPlacementsApplied: number;
};

const TIER_COLORS: Record<string, string> = {
  free:      'text-text3 bg-surface2 border-border',
  pro:       'text-accent2 bg-accent/10 border-accent/30',
  premium:   'text-success bg-success/10 border-success/30',
  unlimited: 'text-success bg-success/10 border-success/30',
};

export default function AdminDashboard() {
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([api.admin.stats(), api.admin.activity(10)])
      .then(([s, a]) => { setStats(s); setActivity(a.activity); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const statCards = [
    { label: 'Total Users',          value: stats?.totalUsers,            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-accent' },
    { label: 'Sigs Used (all)',       value: stats?.totalSignatures,       icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', color: 'text-purple-400' },
    { label: 'Quick-Sign Docs',       value: stats?.totalDocuments,        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-blue-400' },
    { label: 'Sigs (7 days)',         value: stats?.signaturesThisWeek,    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: 'text-success' },
    { label: 'Multi-Sign Requests',   value: stats?.totalRequests,         icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'text-orange-400' },
    { label: 'Slots Signed',          value: stats?.totalSlotsCompleted,   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-teal-400' },
    { label: 'Spots Applied',         value: stats?.totalPlacementsApplied, icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z', color: 'text-pink-400' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text1">Dashboard</h1>
        <p className="text-text2 text-sm mt-1">Overview of your SignEase platform</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {statCards.map(card => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-text3 uppercase tracking-wider">{card.label}</span>
              <svg className={`w-5 h-5 ${card.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
              </svg>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tier breakdown */}
        <div className="card p-6">
          <h2 className="text-sm font-bold text-text1 mb-4">Users by Plan</h2>
          <div className="space-y-3">
            {(stats?.tierBreakdown ?? []).map(({ tier, count }) => {
              const total = stats?.totalUsers || 1;
              const pct   = Math.round((count / total) * 100);
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${TIER_COLORS[tier] ?? 'text-text2 bg-surface2 border-border'}`}>
                      {tier === 'unlimited' ? 'Premium' : tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </span>
                    <span className="text-sm font-bold text-text1">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!stats?.tierBreakdown?.length && <p className="text-sm text-text3">No users yet</p>}
          </div>
          <Link href="/admin/users" className="mt-5 block text-center text-xs font-semibold text-accent2 hover:text-accent transition-colors">
            Manage users →
          </Link>
        </div>

        {/* Recent activity */}
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text1">Recent Activity</h2>
            <div className="flex items-center gap-4">
              <Link href="/admin/requests" className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors">Requests →</Link>
              <Link href="/admin/activity" className="text-xs font-semibold text-accent2 hover:text-accent transition-colors">All activity →</Link>
            </div>
          </div>
          <div className="space-y-2">
            {activity.length === 0 && <p className="text-sm text-text3">No activity yet</p>}
            {activity.map(a => (
              <div key={a.id + a.type} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.type === 'slot_signed' ? 'bg-orange-400/10' : 'bg-accent/10'}`}>
                  <svg className={`w-4 h-4 ${a.type === 'slot_signed' ? 'text-orange-400' : 'text-accent2'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.type === 'slot_signed' ? 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'}/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text1 truncate">{a.document_name || 'document'}</p>
                  <p className="text-[11px] text-text3 truncate">
                    {a.type === 'slot_signed'
                      ? `${a.signer_email} signed for ${a.email}`
                      : a.email}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${a.type === 'slot_signed' ? 'text-orange-400 bg-orange-400/10 border-orange-400/30' : TIER_COLORS[a.tier] ?? ''}`}>
                    {a.type === 'slot_signed' ? 'multi-sign' : (a.tier === 'unlimited' ? 'premium' : a.tier)}
                  </span>
                  <p className="text-[10px] text-text3 mt-0.5">{new Date(a.signed_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
