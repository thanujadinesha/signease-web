'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, AdminUser } from '@/lib/api';

const TIER_BADGE: Record<string, string> = {
  free:      'text-text3 bg-surface2 border-border',
  pro:       'text-accent2 bg-accent/10 border-accent/30',
  premium:   'text-success bg-success/10 border-success/30',
  unlimited: 'text-success bg-success/10 border-success/30',
};

function tierLabel(t: string) {
  return t === 'unlimited' ? 'Premium' : t.charAt(0).toUpperCase() + t.slice(1);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [tier,    setTier]    = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = page, s = search, t = tier) => {
    setLoading(true);
    try {
      const res = await api.admin.users({ search: s, tier: t, page: p, limit: 20 });
      setUsers(res.users); setTotal(res.total); setPages(res.pages);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, search, tier); }, [search, tier]);

  function handlePage(p: number) { setPage(p); load(p, search, tier); }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text1">Users</h1>
          <p className="text-text2 text-sm mt-1">{total} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="search" placeholder="Search by email…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text1 placeholder-text3 focus:outline-none focus:border-accent transition-colors"
        />
        <select
          value={tier} onChange={e => { setTier(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text1 focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2">
              {['Email', 'Plan', 'Signatures', 'Documents', 'Last active', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-text3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-12 text-text3">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-text3 text-sm">No users found</td></tr>
            )}
            {!loading && users.map(u => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-text1 truncate max-w-[200px]">{u.email}</p>
                  <p className="text-[11px] text-text3 font-mono">{u.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${TIER_BADGE[u.tier] ?? ''}`}>
                    {tierLabel(u.tier)}
                  </span>
                  {u.planExpiresAt && (
                    <p className="text-[10px] text-text3 mt-0.5">exp. {fmtDate(u.planExpiresAt)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-text1">{u.signaturesUsed}</p>
                  <p className="text-[11px] text-text3">
                    {u.isUnlimited ? 'unlimited' : `of ${u.limit}`}
                  </p>
                </td>
                <td className="px-4 py-3 font-semibold text-text1">{u.documentCount}</td>
                <td className="px-4 py-3 text-text3 text-xs">{fmtDate(u.lastActivityAt)}</td>
                <td className="px-4 py-3 text-text3 text-xs">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-text2 hover:border-accent hover:text-accent2 transition-colors">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text3">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => handlePage(page - 1)}
              className="px-4 py-2 rounded-xl border border-border text-sm text-text2 hover:border-accent disabled:opacity-40 transition-colors">
              ← Prev
            </button>
            <button disabled={page >= pages} onClick={() => handlePage(page + 1)}
              className="px-4 py-2 rounded-xl border border-border text-sm text-text2 hover:border-accent disabled:opacity-40 transition-colors">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
