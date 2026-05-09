'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import AuthGuard from '@/components/AuthGuard';

const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, premium: 2, unlimited: 2 };

const FLOWS = [
  {
    id: 'sign',
    href: '/dashboard/sign',
    title: 'Quick Sign',
    subtitle: 'Sign a document yourself',
    description: 'Draw or type your signature, upload a document, place your signature, and download.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    minTier: 'free',
    steps: ['Signature', 'Document', 'Place', 'Download'],
    color: 'accent',
  },
  {
    id: 'request',
    href: '/dashboard/request',
    title: 'Request Signature',
    subtitle: 'Send to someone else to sign',
    description: 'Upload a document, mark where to sign, enter recipient details, and share a link for them to sign.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    minTier: 'pro',
    steps: ['Document', 'Mark Spots', 'Recipient', 'Share Link'],
    color: 'purple-400',
  },
  {
    id: 'template',
    href: '/dashboard/template',
    title: 'Template Mode',
    subtitle: 'Sign in multiple places at once',
    description: 'Mark signature positions across all pages, sign once, and your signature is automatically placed everywhere.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    minTier: 'pro',
    steps: ['Document', 'Mark All Pages', 'Sign Once', 'Download'],
    color: 'blue-400',
  },
];

function FlowCard({ flow, userTier }: { flow: typeof FLOWS[0]; userTier: string }) {
  const userLevel = TIER_ORDER[userTier] ?? 0;
  const reqLevel  = TIER_ORDER[flow.minTier] ?? 0;
  const locked    = userLevel < reqLevel;

  const colorMap: Record<string, string> = {
    accent:    'text-accent bg-accent/10',
    'purple-400': 'text-purple-400 bg-purple-400/10',
    'blue-400':   'text-blue-400 bg-blue-400/10',
  };
  const iconClass = colorMap[flow.color] ?? 'text-accent bg-accent/10';

  if (locked) {
    return (
      <div className="card p-6 opacity-60 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-[2px] z-10">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <p className="text-xs font-semibold text-text3 mb-2">Pro / Premium only</p>
            <Link href="/profile" className="inline-block px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors">
              Upgrade plan
            </Link>
          </div>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconClass}`}>
          {flow.icon}
        </div>
        <h3 className="text-lg font-bold text-text1 mb-0.5">{flow.title}</h3>
        <p className="text-xs text-text3 mb-3">{flow.subtitle}</p>
        <p className="text-sm text-text2 mb-4">{flow.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {flow.steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1 text-[11px] text-text3">
              {i > 0 && <span>→</span>}
              <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border">{s}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Link href={flow.href} className="card p-6 block hover:border-accent/50 transition-colors group">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconClass} group-hover:scale-105 transition-transform`}>
        {flow.icon}
      </div>
      <h3 className="text-lg font-bold text-text1 mb-0.5">{flow.title}</h3>
      <p className="text-xs text-text3 mb-3">{flow.subtitle}</p>
      <p className="text-sm text-text2 mb-4">{flow.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {flow.steps.map((s, i) => (
          <span key={s} className="flex items-center gap-1 text-[11px] text-text3">
            {i > 0 && <span>→</span>}
            <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border group-hover:border-accent/30 transition-colors">{s}</span>
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
        Get started <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
      </div>
    </Link>
  );
}

function DashboardContent() {
  const { user } = useAuth();

  const tierLabel = (t: string) => t === 'unlimited' ? 'Premium' : t.charAt(0).toUpperCase() + t.slice(1);
  const tier = user?.tier ?? 'free';

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-base font-bold text-text1 flex-1">SignEase</span>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text3 hidden sm:block">
                {user.isUnlimited ? '∞' : `${user.signaturesUsed}/${user.limit}`} signatures
              </span>
              <Link href="/profile">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:opacity-80 transition-opacity">
                  {user.email[0].toUpperCase()}
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-text1">Choose a workflow</h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold border text-accent2 bg-accent/10 border-accent/30">
              {tierLabel(tier)}
            </span>
          </div>
          <p className="text-text2 text-sm">
            {tier === 'free'
              ? 'You have 1 workflow available. Upgrade to Pro or Premium to unlock all 3.'
              : 'All 3 signing workflows are available on your plan.'}
          </p>
        </div>

        {/* Flow cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FLOWS.map(flow => (
            <FlowCard key={flow.id} flow={flow} userTier={tier} />
          ))}
        </div>

        {/* Usage summary for free users */}
        {tier === 'free' && (
          <div className="mt-8 card p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text1">Free plan · {user?.remaining ?? 0} signatures remaining</p>
              <p className="text-xs text-text3 mt-0.5">Upgrade to Pro for 50 signatures/year or Premium for unlimited signing.</p>
            </div>
            <Link href="/profile" className="shrink-0 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors">
              Upgrade
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <AuthGuard><DashboardContent /></AuthGuard>;
}
