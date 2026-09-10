import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  /** True once the admin check has actually resolved at least once — lets
   *  callers distinguish "confirmed not admin" from "haven't checked yet",
   *  since the admin lookup is a separate, slightly slower fetch than the
   *  session check that `loading` reflects. */
  adminChecked: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Fires when the user returns via the magic link, or after verifyCode
    // succeeds — but also on routine token refreshes, which can briefly
    // report a null session before resolving back to the same user. Only
    // an explicit SIGNED_OUT should be treated as a real logout below.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
        setAdminChecked(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Only re-fetches when the user id genuinely changes to a new, real
  // value — never resets isAdmin just because the id transiently drops to
  // undefined during a token refresh, which previously caused the admin
  // nav link to flicker and disappear during ordinary navigation.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to check admin status:', error);
        } else {
          setIsAdmin(!!data?.is_admin);
        }
        setAdminChecked(true);
      });
  }, [session?.user?.id]);

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
      value={{ session, user: session?.user ?? null, loading, isAdmin, adminChecked, sendCode, verifyCode, signInWithPassword, signOut }}
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
