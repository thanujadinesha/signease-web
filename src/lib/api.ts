const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://apisignease.veloxio.cloud';

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('se_token') : null;
}

function authHeaders(): HeadersInit {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export interface UserProfile {
  id: string;
  email: string;
  tier: string;
  signaturesUsed: number;
  limit: number;
  remaining: number | null;
  isUnlimited: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: UserProfile }>('/api/auth/me'),
  },
  profile: {
    get: () => request<UserProfile>('/api/profile'),
  },
  signatures: {
    canSign: () => request<{ allowed: boolean }>('/api/signatures/can-sign'),
    record:  (documentName: string) =>
      request<{ success: boolean }>('/api/signatures/record', {
        method: 'POST',
        body: JSON.stringify({ documentName }),
      }),
  },
  billing: {
    checkout: (plan: 'pro' | 'premium' | 'seat') =>
      request<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }),
    plans: () => request<{
      plans: { id: string; name: string; price: number; period: string | null; signatures: number; features: string[] }[];
      seatPrice: number;
    }>('/api/billing/plans'),
  },
};
