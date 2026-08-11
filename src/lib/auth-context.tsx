import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Session, User } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<AuthResult>;
};

const NOT_CONFIGURED_ERROR = "Backend not configured";

function friendlyAuthError(error: { code?: string; message: string }): string {
  if (error.code === "invalid_credentials") return "Wrong email or password";
  if (error.code === "email_exists") {
    return "An account with this email already exists";
  }
  if (
    error.code === "fetch_failed" ||
    /fetch failed|network request failed|failed to fetch/i.test(error.message)
  ) {
    return "Network error — check your connection";
  }
  return error.message;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      initializedRef.current = true;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { error: NOT_CONFIGURED_ERROR };
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ? friendlyAuthError(error) : null };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) return { error: NOT_CONFIGURED_ERROR };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) return { error: friendlyAuthError(error) };
      // Email confirmation enabled: user row exists but no session yet.
      if (data.user && !data.session) {
        return { error: "Check your email to confirm your account" };
      }
      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await supabase?.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED_ERROR };
    try {
      const { error } = await supabase.rpc("delete_account");
      if (error) return { error: error.message };
    } catch {
      return { error: "Could not delete account — try again" };
    }
    await supabase.auth.signOut();
    return { error: null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isConfigured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      deleteAccount,
    }),
    [session, loading, signIn, signUp, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
