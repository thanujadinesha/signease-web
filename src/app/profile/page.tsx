'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AuthGuard from '@/components/AuthGuard';

function ProfileContent() {
  const { user, signOut, refresh } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const limit     = user.limit;
  const used      = user.signaturesUsed;
  const remaining = user.remaining ?? 0;
  const progress  = limit < 0 ? 0 : Math.min(1, used / limit);
  const isCritical = !user.isUnlimited && remaining <= 1;

  const tierLabel = (t: string) =>
    ({ pro: 'Pro', unlimited: 'Unlimited' }[t] ?? 'Free');

  function handleSignOut() {
    signOut();
    router.push('/login');
  }

  return (
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
            user.tier === 'unlimited' ? 'bg-success/10 border-success/30 text-success' :
            user.tier === 'pro'       ? 'bg-accent/10 border-accent/30 text-accent2' :
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
          <div>
            <div className="text-3xl font-bold text-accent">{used}</div>
            <div className="text-xs text-text3">Signed</div>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <div className={`text-3xl font-bold ${isCritical ? 'text-danger' : 'text-success'}`}>
              {user.isUnlimited ? '∞' : remaining}
            </div>
            <div className="text-xs text-text3">Remaining</div>
          </div>
          {!user.isUnlimited && (
            <>
              <div className="w-px h-10 bg-border" />
              <div>
                <div className="text-3xl font-bold text-text2">{limit}</div>
                <div className="text-xs text-text3">Limit</div>
              </div>
            </>
          )}
        </div>

        {!user.isUnlimited && (
          <>
            <div className="h-1.5 rounded-full bg-border overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${isCritical ? 'bg-danger' : 'bg-accent'}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className={`text-xs ${isCritical ? 'text-danger' : 'text-text3'}`}>
              {isCritical
                ? remaining === 0 ? 'No signatures remaining — upgrade to continue' : `${remaining} signature remaining`
                : `${remaining} of ${limit} signatures remaining`}
            </p>
          </>
        )}
      </div>

      {/* Upgrade card (non-unlimited) */}
      {!user.isUnlimited && (
        <div className="card p-4 flex items-center gap-4 mb-6"
             style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.15), rgba(139,92,246,0.08))' }}>
          <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-accent2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text1">Upgrade to Pro</p>
            <p className="text-xs text-text2 mt-0.5">
              {user.tier === 'free' ? 'Get 50 signatures & priority support' : 'Get unlimited signatures'}
            </p>
          </div>
          <button className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-accent to-purple-700 shrink-0">
            Upgrade
          </button>
        </div>
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
          <svg className="w-4 h-4 text-text3 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span className="text-sm text-text2 flex-1">Plan</span>
          <span className={`text-sm font-bold ${
            user.tier === 'unlimited' ? 'text-success' : user.tier === 'pro' ? 'text-accent2' : 'text-text2'
          }`}>{tierLabel(user.tier)}</span>
        </div>
      </div>

      {/* Refresh */}
      <button onClick={refresh} className="w-full py-3 rounded-xl border border-border text-sm text-text2 hover:border-accent hover:text-text1 transition-colors mb-3">
        Refresh usage
      </button>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3 rounded-xl border border-danger/25 bg-danger/[0.06] text-danger text-sm font-semibold hover:bg-danger/10 transition-colors"
      >
        Sign out
      </button>

      <p className="text-center text-xs text-text3 mt-8">
        🔒 Documents are processed locally. No files are uploaded.
      </p>
    </div>
  );
}

export default function ProfilePage() {
  return <AuthGuard><ProfileContent /></AuthGuard>;
}
