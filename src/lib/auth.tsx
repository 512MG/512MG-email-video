import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthState = {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  /** Signed in with a password, but two-step verification still needs the 6-digit code. */
  needsMfa: boolean;
  refresh: () => Promise<void>;
};
const Ctx = createContext<AuthState>({ session: null, isAdmin: false, loading: true, needsMfa: false, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [loading, setLoading] = useState(true);

  const evaluate = async (s: Session | null) => {
    if (!s) { setIsAdmin(false); setNeedsMfa(false); return; }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfa = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
    setNeedsMfa(mfa);
    if (mfa) { setIsAdmin(false); return; }
    const { data } = await supabase.from("agency_admins").select("user_id").eq("user_id", s.user.id).maybeSingle();
    setIsAdmin(!!data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await evaluate(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Supabase advises not awaiting other auth calls inside this callback
      setTimeout(() => evaluate(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await evaluate(data.session);
  };

  return <Ctx.Provider value={{ session, isAdmin, loading, needsMfa, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
