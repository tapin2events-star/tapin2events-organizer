import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Sends one email containing BOTH a magic link and a 6-digit code. */
  sendCode: (email: string) => Promise<{ error: string | null }>;
  /** Completes sign-in when the user types the 6-digit code. */
  verifyCode: (email: string, code: string) => Promise<{ error: string | null }>;
  /** Fallback path for accounts that have a password set. Most migrated
   *  accounts have no password at all, so this only works where one has
   *  been deliberately configured. */
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Fires when the user returns via the magic link, or after verifyCode succeeds.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendCode(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // New emails are signed up automatically; the OTP step itself
        // verifies they own the address before any session is created.
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    return { error: error?.message ?? null };
  }

  async function verifyCode(email: string, code: string) {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    return { error: error?.message ?? null };
  }

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, sendCode, verifyCode, signInWithPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
