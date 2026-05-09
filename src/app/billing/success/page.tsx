'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function BillingSuccessPage() {
  const { refresh } = useAuth();

  useEffect(() => {
    // Refresh user profile so the new tier is reflected immediately
    refresh();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-20 h-20 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-text1 mb-2">Payment successful!</h1>
        <p className="text-text2 text-sm mb-8">
          Your plan has been upgraded. You can now enjoy your new signature limit.
        </p>
        <Link href="/profile" className="btn-primary block w-full text-center py-3">
          View my plan
        </Link>
        <Link href="/dashboard" className="block mt-3 text-sm text-text2 hover:text-text1 transition-colors">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
