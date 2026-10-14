import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

function Shell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>("setup_status").then((r) => setNeedsSetup(r.needsSetup)).catch(() => {});
  }, []);

  if (!loading && session) return <Navigate to="/" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr("That email and password don't match.");
    else nav("/");
  };

  return (
    <Shell title="Sign in" sub="Video pages dashboard">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
        <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-xs text-zinc-500">Forgotten your password? Ask your account manager to reset it.</p>
      </form>
    </Shell>
  );
}

export function Setup() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    api<{ needsSetup: boolean }>("setup_status").then((r) => setAllowed(r.needsSetup)).catch(() => setAllowed(false));
  }, []);

  if (allowed === false) return <Navigate to="/login" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("setup", { code, email: email.trim(), password });
      await supabase.auth.signInWithPassword({ email: email.trim(), password });
      nav("/");
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Shell title="First-time setup" sub="Create the agency admin login. This page disappears once it's done.">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Setup code</label><input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus /></div>
        <div><label className="label">Your email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">Choose a password</label><input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || allowed === null}>{busy ? "Creating…" : "Create admin login"}</button>
      </form>
    </Shell>
  );
}

export function Account() {
  const { session } = useAuth();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setMsg(error ? error.message : "Password updated.");
    if (!error) setPw("");
  };
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Your account</h1>
      <div className="card">
        <p className="mb-4 text-sm text-zinc-600">Signed in as <strong>{session?.user.email}</strong></p>
        <form onSubmit={save} className="space-y-3">
          <div><label className="label">New password</label><input className="input" type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
          <button className="btn-primary">Change password</button>
          {msg && <p className="text-sm text-zinc-600">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
