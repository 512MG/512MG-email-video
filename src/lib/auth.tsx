import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthState = { session: Session | null; isAdmin: boolean; loading: boolean; refreshAdmin: () => Promise<void> };
const Ctx = createContext<AuthState>({ session: null, isAdmin: false, loading: true, refreshAdmin: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = async (s: Session | null) => {
    if (!s) { setIsAdmin(false); return; }
    const { data } = await supabase.from("agency_admins").select("user_id").eq("user_id", s.user.id).maybeSingle();
    setIsAdmin(!!data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await checkAdmin(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      checkAdmin(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, isAdmin, loading, refreshAdmin: () => checkAdmin(session) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
