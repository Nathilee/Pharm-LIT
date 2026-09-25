import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, setApiToken } from '@/lib/api';
import type { User } from '@/lib/types';

const TOKEN_KEY = 'pharmlit.token';

interface AuthState {
  user: User | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<Pick<User, 'name' | 'phone' | 'address'>>) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = useCallback(async (token: string, u: User) => {
    setApiToken(token);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          setApiToken(token);
          const { user: me } = await api<{ user: User }>('GET', '/api/auth/me');
          setUser(me);
        }
      } catch {
        setApiToken(null);
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isStaff: user?.role === 'admin' || user?.role === 'pharmacist',
      isAdmin: user?.role === 'admin',
      login: async (email, password) => {
        const r = await api<{ token: string; user: User }>('POST', '/api/auth/login', { email, password });
        return signIn(r.token, r.user);
      },
      register: async (data) => {
        const r = await api<{ token: string; user: User }>('POST', '/api/auth/register', data);
        return signIn(r.token, r.user);
      },
      logout: async () => {
        setApiToken(null);
        await AsyncStorage.removeItem(TOKEN_KEY);
        setUser(null);
      },
      refresh: async () => {
        const { user: me } = await api<{ user: User }>('GET', '/api/auth/me');
        setUser(me);
      },
      updateProfile: async (data) => {
        const { user: me } = await api<{ user: User }>('PATCH', '/api/auth/me', data);
        setUser(me);
      },
    }),
    [user, loading, signIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
