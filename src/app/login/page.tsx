'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) { setError(err); return; }
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.4)]">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold text-text1">SignEase</div>
            <div className="text-xs text-text3">Document Signing</div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-text1 mb-2">Welcome back</h1>
        <p className="text-text2 text-sm mb-8">Sign in to your account to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text2 mb-2">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text2 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="input-field"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : 'Sign in'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-bg text-text3 text-xs">or</span>
          </div>
        </div>

        <Link href="/register" className="block w-full py-3 rounded-xl border border-border text-center text-sm text-text2 hover:border-accent hover:text-text1 transition-colors">
          Don&apos;t have an account? <span className="font-bold text-accent2">Create one</span>
        </Link>

        <p className="text-center text-xs text-text3 mt-8">
          🔒 Documents are processed locally. No files are uploaded.
        </p>
      </div>
    </div>
  );
}
