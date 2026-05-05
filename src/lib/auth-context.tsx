'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, UserProfile } from './api';

interface AuthCtx {
  user:     UserProfile | null;
  loading:  boolean;
  signIn:   (email: string, password: string) => Promise<string | null>;
  signUp:   (email: string, password: string) => Promise<string | null>;
  signOut:  () => void;
  refresh:  () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('se_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const data = await api.auth.me();
      setUser(data.user);
    } catch {
      localStorage.removeItem('se_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await api.auth.login(email, password);
      localStorage.setItem('se_token', data.token);
      setUser(data.user);
      return null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : 'Login failed';
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const data = await api.auth.register(email, password);
      localStorage.setItem('se_token', data.token);
      setUser(data.user);
      return null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : 'Registration failed';
    }
  };

  const signOut = () => {
    localStorage.removeItem('se_token');
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
