'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const err = await signUp(email, password);
    setLoading(false);
    if (err) { setError(err); return; }
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-1 text-text2 text-sm mb-8 hover:text-text1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to sign in
        </Link>

        <h1 className="text-3xl font-bold text-text1 mb-2">Create account</h1>
        <p className="text-text2 text-sm mb-4">Start signing documents for free</p>

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success/[0.06] border border-success/20 text-success text-xs mb-8">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Free tier includes 3 signed documents
        </div>

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
              placeholder="Min. 6 characters"
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text2 mb-2">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
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
                Creating account…
              </span>
            ) : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-text3 mt-8">
          🔒 Documents are processed locally. No files are uploaded.
        </p>
      </div>
    </div>
  );
}
