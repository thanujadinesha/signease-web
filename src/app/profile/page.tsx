'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

// ─── Plan definitions ────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: 0,
    period: null,
    signatures: '3 total',
    features: ['3 signatures total', 'PDF & image support', 'Download signed docs'],
    color: 'text-text2',
    border: 'border-border',
    badge: 'bg-surface2 border-border text-text3',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 25,
    period: 'year',
    signatures: '50 / year',
    features: ['50 signatures / year', 'All Free features', 'Priority support'],
    color: 'text-accent2',
    border: 'border-accent/40',
    badge: 'bg-accent/10 border-accent/30 text-accent2',
    popular: true,
  },
  {
    id: 'premium' as const,
    name: 'Premium',
    price: 50,
    period: 'year',
    signatures: 'Unlimited',
    features: ['Unlimited signatures', 'All Pro features', 'Team management'],
    color: 'text-success',
    border: 'border-success/30',
    badge: 'bg-success/10 border-success/30 text-success',
  },
];

const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, premium: 2, unlimited: 2 };

// ─── Upgrade modal ────────────────────────────────────────────────────────────

function UpgradeModal({ currentTier, onClose }: { currentTier: string; onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState('');
  const currentLevel = TIER_ORDER[currentTier] ?? 0;

  async function handleUpgrade(plan: 'pro' | 'premium') {
    setLoading(plan); setError('');
    try {
      const { url } = await api.billing.checkout(plan);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
      setLoading(null);
    }
  }

  async function handleBuySeat() {
    setLoading('seat'); setError('');
    try {
      const { url } = await api.billing.checkout('seat');
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-bold text-text1">Choose a Plan</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text2 hover:border-accent transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}

          {/* Plan cards */}
          {PLANS.map(plan => {
            const isCurrent  = currentTier === plan.id || (plan.id === 'premium' && currentTier === 'unlimited');
            const isOwned    = plan.id !== 'free' && TIER_ORDER[currentTier] >= TIER_ORDER[plan.id];
            const canUpgrade = plan.id !== 'free' && !isCurrent && TIER_ORDER[plan.id] > currentLevel;

            return (
              <div key={plan.id} className={`relative rounded-xl border p-4 ${plan.border} ${plan.popular ? 'ring-1 ring-accent/30' : ''}`}
                   style={{ background: plan.popular ? 'rgba(139,92,246,0.04)' : undefined }}>
                {plan.popular && (
                  <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white">POPULAR</span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-sm ${plan.color}`}>{plan.name}</span>
                      {isCurrent && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${plan.badge}`}>Current</span>}
                    </div>
                    <div className="text-text1 font-bold text-lg mb-2">
                      {plan.price === 0 ? 'Free' : `$${plan.price}`}
                      {plan.period && <span className="text-xs font-normal text-text3"> / {plan.period}</span>}
                    </div>
                    <ul className="space-y-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs text-text2">
                          <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {canUpgrade && (
                    <button
                      onClick={() => handleUpgrade(plan.id as 'pro' | 'premium')}
                      disabled={loading !== null}
                      className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-accent to-purple-700 disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {loading === plan.id ? '…' : 'Upgrade'}
                    </button>
                  )}
                  {isOwned && (
                    <span className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold text-success border border-success/30 bg-success/5">Active</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Extra seat add-on */}
          {currentLevel >= 1 && (
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text1">Extra Seat</p>
                  <p className="text-xs text-text2 mt-0.5">Add a team member to your plan</p>
                  <p className="text-lg font-bold text-text1 mt-1">$5 <span className="text-xs font-normal text-text3">/ person</span></p>
                </div>
                <button
                  onClick={handleBuySeat}
                  disabled={loading !== null}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-accent text-accent2 hover:bg-accent/5 disabled:opacity-50 transition-colors"
                >
                  {loading === 'seat' ? '…' : 'Add Seat'}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-[10px] text-text3 pt-1">
            Secure payment via Stripe · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Profile content ──────────────────────────────────────────────────────────

function ProfileContent() {
  const { user, signOut, refresh } = useAuth();
  const router = useRouter();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (!user) return null;

  const limit      = user.limit;
  const used       = user.signaturesUsed;
  const remaining  = user.remaining ?? 0;
  const progress   = limit < 0 ? 0 : Math.min(1, used / limit);
  const isCritical = !user.isUnlimited && remaining <= 1;
  const tierLevel  = TIER_ORDER[user.tier] ?? 0;

  const tierLabel = (t: string) =>
    ({ pro: 'Pro', premium: 'Premium', unlimited: 'Premium' }[t] ?? 'Free');

  function handleSignOut() { signOut(); router.push('/login'); }

  return (
    <>
      {showUpgrade && <UpgradeModal currentTier={user.tier} onClose={() => { setShowUpgrade(false); refresh(); }} />}

      <div className="min-h-screen p-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="p-2 rounded-xl border border-border hover:border-accent transition-colors">
            <svg className="w-5 h-5 text-text2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <h1 className="text-lg font-semibold text-text1">My Account</h1>
        </div>

        {/* Avatar + info */}
        <div className="card p-5 flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center text-white text-xl font-bold shadow-[0_0_20px_rgba(139,92,246,0.4)] shrink-0">
            {user.email[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-text1 font-semibold text-sm truncate">{user.email}</p>
            <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold border ${
              tierLevel >= 2 ? 'bg-success/10 border-success/30 text-success' :
              tierLevel === 1 ? 'bg-accent/10 border-accent/30 text-accent2' :
                               'bg-text3/10 border-text3/30 text-text3'
            }`}>
              {tierLabel(user.tier)}
            </span>
          </div>
        </div>

        {/* Usage card */}
        <div className={`card p-5 mb-4 ${isCritical ? 'border-danger/40' : 'border-accent/25'}`}
             style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03))' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-text1">Signature Usage</span>
            <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
              isCritical ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-surface border-border text-text2'
            }`}>
              {user.isUnlimited ? 'Unlimited' : `${used} / ${limit} used`}
            </span>
          </div>

          <div className="flex items-center gap-5 mb-4">
            <div><div className="text-3xl font-bold text-accent">{used}</div><div className="text-xs text-text3">Signed</div></div>
            <div className="w-px h-10 bg-border" />
            <div>
              <div className={`text-3xl font-bold ${isCritical ? 'text-danger' : 'text-success'}`}>
                {user.isUnlimited ? '∞' : remaining}
              </div>
              <div className="text-xs text-text3">Remaining</div>
            </div>
            {!user.isUnlimited && (<><div className="w-px h-10 bg-border" /><div><div className="text-3xl font-bold text-text2">{limit}</div><div className="text-xs text-text3">Limit</div></div></>)}
          </div>

          {!user.isUnlimited && (
            <>
              <div className="h-1.5 rounded-full bg-border overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all ${isCritical ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${progress * 100}%` }} />
              </div>
              <p className={`text-xs ${isCritical ? 'text-danger' : 'text-text3'}`}>
                {isCritical
                  ? remaining === 0 ? 'No signatures remaining — upgrade to continue' : `${remaining} signature remaining`
                  : `${remaining} of ${limit} signatures remaining`}
              </p>
            </>
          )}
        </div>

        {/* Plan cards summary */}
        <p className="text-xs font-bold text-text3 uppercase tracking-widest mb-3">Plans</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PLANS.map(plan => {
            const isActive = user.tier === plan.id || (plan.id === 'premium' && (user.tier === 'premium' || user.tier === 'unlimited'));
            const isPast   = TIER_ORDER[user.tier] > TIER_ORDER[plan.id];
            return (
              <div key={plan.id} className={`card p-3 text-center border ${isActive ? plan.border : 'border-border opacity-60'}`}>
                <p className={`text-xs font-bold mb-0.5 ${plan.color}`}>{plan.name}</p>
                <p className="text-[10px] text-text3">{plan.price === 0 ? 'Free' : `$${plan.price}/yr`}</p>
                <p className="text-[10px] text-text3 mt-1">{plan.signatures}</p>
                {isActive && <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-success mx-auto" />}
              </div>
            );
          })}
        </div>

        {/* Upgrade CTA */}
        {tierLevel < 2 && (
          <button onClick={() => setShowUpgrade(true)} className="w-full card p-4 flex items-center gap-4 mb-4 text-left hover:border-accent transition-colors"
                  style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.15), rgba(139,92,246,0.08))' }}>
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-accent2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text1">{tierLevel === 0 ? 'Upgrade to Pro or Premium' : 'Upgrade to Premium'}</p>
              <p className="text-xs text-text2 mt-0.5">
                {tierLevel === 0 ? 'Pro $25/yr · Premium $50/yr' : 'Unlimited signatures for $50/yr'}
              </p>
            </div>
            <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        )}

        {/* Extra seat CTA for Pro/Premium */}
        {tierLevel >= 1 && (
          <button onClick={() => setShowUpgrade(true)} className="w-full card p-4 flex items-center gap-4 mb-4 text-left hover:border-accent transition-colors">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text1">Add Team Member</p>
              <p className="text-xs text-text2 mt-0.5">$5 per additional user</p>
            </div>
            <svg className="w-4 h-4 text-text3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        )}

        {/* Account details */}
        <p className="text-xs font-bold text-text3 uppercase tracking-widest mb-3">Account Details</p>
        <div className="card divide-y divide-border mb-6">
          <div className="flex items-center px-4 py-3.5">
            <svg className="w-4 h-4 text-text3 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <span className="text-sm text-text2 flex-1">Email</span>
            <span className="text-sm font-semibold text-text1 truncate max-w-[180px]">{user.email}</span>
          </div>
          <div className="flex items-center px-4 py-3.5">
            <svg className="w-4 h-4 text-text3 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <span className="text-sm text-text2 flex-1">Plan</span>
            <span className={`text-sm font-bold ${tierLevel >= 2 ? 'text-success' : tierLevel === 1 ? 'text-accent2' : 'text-text2'}`}>
              {tierLabel(user.tier)}
            </span>
          </div>
        </div>

        <button onClick={refresh} className="w-full py-3 rounded-xl border border-border text-sm text-text2 hover:border-accent hover:text-text1 transition-colors mb-3">
          Refresh usage
        </button>
        <button onClick={handleSignOut} className="w-full py-3 rounded-xl border border-danger/25 bg-danger/[0.06] text-danger text-sm font-semibold hover:bg-danger/10 transition-colors">
          Sign out
        </button>

        <p className="text-center text-xs text-text3 mt-8">
          🔒 Documents are processed locally. No files are uploaded.
        </p>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return <AuthGuard><ProfileContent /></AuthGuard>;
}
