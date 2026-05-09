'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, AdminUser, AdminDoc } from '@/lib/api';

const TIERS = ['free', 'pro', 'premium'];
const TIER_BADGE: Record<string, string> = {
  free:      'text-text3 bg-surface2 border-border',
  pro:       'text-accent2 bg-accent/10 border-accent/30',
  premium:   'text-success bg-success/10 border-success/30',
  unlimited: 'text-success bg-success/10 border-success/30',
};
function tierLabel(t: string) { return t === 'unlimited' ? 'Premium' : t.charAt(0).toUpperCase() + t.slice(1); }
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminUserDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [user,    setUser]    = useState<AdminUser | null>(null);
  const [docs,    setDocs]    = useState<AdminDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Edit state
  const [editTier,  setEditTier]  = useState('');
  const [editUsage, setEditUsage] = useState('');
  const [editSeats, setEditSeats] = useState('');

  useEffect(() => {
    api.admin.user(id)
      .then(res => {
        setUser(res.user); setDocs(res.documents);
        setEditTier(res.user.tier === 'unlimited' ? 'premium' : res.user.tier);
        setEditUsage(String(res.user.signaturesUsed));
        setEditSeats(String(res.user.extraSeats));
      })
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!user) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.admin.updateUser(id, {
        tier:           editTier,
        signaturesUsed: parseInt(editUsage, 10),
        extraSeats:     parseInt(editSeats, 10),
      });
      setUser(res.user);
      setSuccess('User updated successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetUsage() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.admin.updateUser(id, { resetUsage: true });
      setUser(res.user); setEditUsage('0');
      setSuccess('Usage reset to 0');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${user?.email}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.admin.deleteUser(id);
      router.push('/admin/users');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <div className="p-8 text-danger">User not found</div>;

  const tierLevel = (t: string) => ({ free: 0, pro: 1, premium: 2, unlimited: 2 }[t] ?? 0);

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-text2 hover:border-accent transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-text1">{user.email}</h1>
          <p className="text-xs text-text3 font-mono mt-0.5">{user.id}</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${TIER_BADGE[user.tier]}`}>
          {tierLabel(user.tier)}
        </span>
      </div>

      {error   && <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">{error}</div>}
      {success && <div className="mb-4 text-sm text-success bg-success/10 border border-success/20 rounded-xl px-4 py-3">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Stats */}
        {[
          { label: 'Signatures used',  value: user.signaturesUsed,  color: 'text-accent' },
          { label: 'Documents signed', value: user.documentCount,   color: 'text-purple-400' },
          { label: 'Extra seats',      value: user.extraSeats,      color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-xs text-text3 uppercase tracking-wider font-semibold mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Account info */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text1 mb-4">Account Info</h2>
          <dl className="space-y-2.5 text-sm">
            {[
              { label: 'Email',        value: user.email },
              { label: 'Joined',       value: fmtDate(user.createdAt) },
              { label: 'Last active',  value: fmtDate(user.lastActivityAt) },
              { label: 'Plan expires', value: fmtDate(user.planExpiresAt) },
              { label: 'Limit',        value: user.isUnlimited ? 'Unlimited' : String(user.limit) },
              { label: 'Remaining',    value: user.isUnlimited ? '∞' : String(user.remaining ?? 0) },
            ].map(row => (
              <div key={row.label} className="flex justify-between gap-4 py-1.5 border-b border-border last:border-0">
                <dt className="text-text3 shrink-0">{row.label}</dt>
                <dd className="text-text1 font-medium text-right truncate">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Edit controls */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text1 mb-4">Manage Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text2 mb-1.5">Plan tier</label>
              <select value={editTier} onChange={e => setEditTier(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-xl px-3 py-2.5 text-sm text-text1 focus:outline-none focus:border-accent transition-colors">
                {TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text2 mb-1.5">Signatures used</label>
              <div className="flex gap-2">
                <input type="number" min="0" value={editUsage} onChange={e => setEditUsage(e.target.value)}
                  className="flex-1 bg-surface2 border border-border rounded-xl px-3 py-2.5 text-sm text-text1 focus:outline-none focus:border-accent transition-colors" />
                <button onClick={handleResetUsage} disabled={saving}
                  className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text2 hover:border-accent hover:text-text1 transition-colors disabled:opacity-50">
                  Reset
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text2 mb-1.5">Extra seats</label>
              <input type="number" min="0" value={editSeats} onChange={e => setEditSeats(e.target.value)}
                className="w-full bg-surface2 border border-border rounded-xl px-3 py-2.5 text-sm text-text1 focus:outline-none focus:border-accent transition-colors" />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full btn-primary py-2.5 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Documents table */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-text1">Signed Documents ({docs.length})</h2>
        </div>
        {docs.length === 0 ? (
          <p className="text-center py-8 text-sm text-text3">No documents signed yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2">
                <th className="text-left px-5 py-3 text-xs font-bold text-text3 uppercase tracking-wider">Document</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-text3 uppercase tracking-wider">Signed at</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface2/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      <span className="text-text1 font-medium truncate max-w-[300px]">{d.document_name || 'document'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-text3 text-xs">{fmtDate(d.signed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger zone */}
      <div className="card p-5 border-danger/20">
        <h2 className="text-sm font-bold text-danger mb-3">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text1 font-medium">Delete this account</p>
            <p className="text-xs text-text3 mt-0.5">Permanently removes user and all their data. Cannot be undone.</p>
          </div>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/20 transition-colors disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete user'}
          </button>
        </div>
      </div>
    </div>
  );
}
