'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const router  = useRouter();
  const path    = usePathname();

  const isLoginPage = path === '/admin/login';

  useEffect(() => {
    // Skip auth check on the login page itself — avoids infinite redirect loop
    if (isLoginPage) { setChecking(false); return; }
    api.admin.stats()
      .then(() => setChecking(false))
      .catch(() => router.replace('/admin/login'));
  }, [isLoginPage]);

  // On the login page render children directly — no sidebar, no auth spinner
  if (isLoginPage) return <>{children}</>;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nav = [
    { href: '/admin',           label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/admin/users',     label: 'Users',     icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { href: '/admin/requests',  label: 'Requests',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { href: '/admin/activity',  label: 'Activity',  icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs font-bold text-text3 uppercase tracking-widest">iSigner</p>
          <p className="text-sm font-bold text-accent2 mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => {
            const active = path === item.href || (item.href !== '/admin' && path.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-accent text-white' : 'text-text2 hover:bg-surface2 hover:text-text1'
                }`}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-text3 hover:text-text1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back to app
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
