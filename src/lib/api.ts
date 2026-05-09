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

export interface AdminUser {
  id: string; email: string; tier: string; isAdmin: boolean;
  signaturesUsed: number; documentCount: number;
  limit: number; remaining: number | null; isUnlimited: boolean;
  planExpiresAt: string | null; extraSeats: number; createdAt: string;
  lastActivityAt: string | null;
}
export interface AdminDoc { id: string; document_name: string; signed_at: string; }
export interface AdminActivity {
  id: string; document_name: string; signed_at: string;
  user_id: string; email: string; tier: string;
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
  admin: {
    stats: () => request<{
      totalUsers: number; totalSignatures: number; totalDocuments: number;
      signaturesThisWeek: number;
      tierBreakdown: { tier: string; count: number }[];
    }>('/api/admin/stats'),

    users: (params?: { search?: string; tier?: string; page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.tier)   q.set('tier',   params.tier);
      if (params?.page)   q.set('page',   String(params.page));
      if (params?.limit)  q.set('limit',  String(params.limit));
      return request<{
        users: AdminUser[]; total: number; page: number; pages: number;
      }>(`/api/admin/users?${q}`);
    },

    user: (id: string) => request<{ user: AdminUser; documents: AdminDoc[] }>(`/api/admin/users/${id}`),

    updateUser: (id: string, body: { tier?: string; signaturesUsed?: number; extraSeats?: number; resetUsage?: boolean }) =>
      request<{ user: AdminUser }>(`/api/admin/users/${id}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }),

    deleteUser: (id: string) =>
      request<{ success: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

    activity: (limit = 50) =>
      request<{ activity: AdminActivity[] }>(`/api/admin/activity?limit=${limit}`),
  },
  requests: {
    create: (body: {
      documentName: string;
      documentData: string;
      documentType?: string;
      recipientEmail?: string;
      message?: string;
      placements: { x: number; y: number; w: number; h: number; page: number; pageW: number; pageH: number }[];
    }) => request<{ id: string; token: string; createdAt: string }>('/api/requests', {
      method: 'POST', body: JSON.stringify(body),
    }),
    list: () => request<{
      requests: { id: string; documentName: string; recipientEmail: string | null; status: string; token: string; createdAt: string; signedAt: string | null }[];
    }>('/api/requests'),
    get: (token: string) => request<{
      id: string; documentName: string; documentData: string; documentType: string;
      recipientEmail: string | null; message: string | null;
      placements: { x: number; y: number; w: number; h: number; page: number; pageW: number; pageH: number }[];
      createdAt: string;
    }>(`/api/requests/${token}`),
    sign: (token: string, signedPdf: string) =>
      request<{ success: boolean }>(`/api/requests/${token}/sign`, {
        method: 'POST', body: JSON.stringify({ signedPdf }),
      }),
    getSigned: (token: string) =>
      request<{ signedPdf: string; documentName: string }>(`/api/requests/${token}/signed`),
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
