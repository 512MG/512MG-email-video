import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const MIN_PASSWORD = 12;

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

/** Simple strength rules shown as you type. */
function passwordProblem(pw: string, email?: string) {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds < 3) return "Mix at least three of: lowercase, capitals, numbers, symbols.";
  if (email && pw.toLowerCase().includes(email.split("@")[0].toLowerCase())) return "Don't include your email name in the password.";
  if (/^(.)\1+$/.test(pw) || /password|123456|qwerty/i.test(pw)) return "That password is too easy to guess.";
  return null;
}

export function Login() {
  const { session, loading, needsMfa } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>("setup_status").then((r) => setNeedsSetup(r.needsSetup)).catch(() => {});
  }, []);

  if (!loading && session && needsMfa) return <Navigate to="/verify" replace />;
  if (!loading && session) return <Navigate to="/" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setErr(/rate|too many/i.test(error.message) ? "Too many attempts. Please wait a few minutes and try again." : "That email and password don't match.");
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setBusy(false);
    nav(aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" ? "/verify" : "/");
  };

  return (
    <Shell title="Sign in" sub="Video pages dashboard">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Email</label><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
        <div><label className="label">Password</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-xs text-zinc-500">Forgotten your password? Ask your account manager to reset it.</p>
      </form>
    </Shell>
  );
}

/** Second step of sign-in for anyone with two-step verification switched on. */
export function Verify() {
  const { session, loading, needsMfa, refresh } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && !session) return <Navigate to="/login" replace />;
  if (!loading && session && !needsMfa) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === "verified");
    if (!factor) { setBusy(false); setErr("No authenticator found on this account."); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
    if (error) { setBusy(false); setErr("That code didn't work. Check the time on your phone and try the newest code."); return; }
    await refresh();
    setBusy(false);
    nav("/");
  };

  return (
    <Shell title="Two-step verification" sub="Enter the 6-digit code from your authenticator app.">
      <form onSubmit={submit} className="space-y-4">
        <input className="input text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
          value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} autoFocus required />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || code.replace(/\s/g, "").length < 6}>{busy ? "Checking…" : "Verify"}</button>
        <button type="button" className="w-full text-center text-xs text-zinc-500 hover:text-ink" onClick={() => supabase.auth.signOut()}>Sign in as someone else</button>
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
  const problem = password ? passwordProblem(password, email) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordProblem(password, email)) return;
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
        <div><label className="label">Your email</label><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div>
          <label className="label">Choose a password</label>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {problem && <p className="mt-1 text-xs text-amber-700">{problem}</p>}
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || allowed === null || !!problem}>{busy ? "Creating…" : "Create admin login"}</button>
      </form>
    </Shell>
  );
}

export function Account() {
  const { session, isAdmin } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const problem = pw ? passwordProblem(pw, session?.user.email ?? undefined) : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    if (pw !== pw2) { setMsg("The two passwords don't match."); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setMsg(error ? error.message : "Password updated.");
    if (!error) { setPw(""); setPw2(""); }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Your account</h1>
      <div className="card">
        <p className="mb-4 text-sm text-zinc-600">Signed in as <strong>{session?.user.email}</strong></p>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setMsg(""); }} required />
            {problem && <p className="mt-1 text-xs text-amber-700">{problem}</p>}
          </div>
          <div><label className="label">Repeat new password</label><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setMsg(""); }} required /></div>
          <button className="btn-primary" disabled={!!problem || !pw}>Change password</button>
          {msg && <p className="text-sm text-zinc-600">{msg}</p>}
        </form>
      </div>
      <TwoStep />
      {isAdmin && <Backups />}
    </div>
  );
}

/** Set up or remove an authenticator app (TOTP). */
function TwoStep() {
  const { refresh } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [enrol, setEnrol] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp?.find((f) => f.status === "verified")?.id ?? null);
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const start = async () => {
    setMsg(""); setBusy(true);
    // Clear out any half-finished set-up first
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) { setMsg(error?.message ?? "Couldn't start set-up."); return; }
    setEnrol({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrol) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrol.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) { setMsg("That code didn't work. Try the newest code from the app."); return; }
    setEnrol(null); setCode("");
    setMsg("Two-step verification is on. You'll be asked for a code each time you sign in.");
    await refresh(); load();
  };

  const remove = async () => {
    if (!factorId || !window.confirm("Turn off two-step verification? Your account will only be protected by your password.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { setMsg(error.message); return; }
    await supabase.auth.refreshSession();
    await refresh(); load();
    setMsg("Two-step verification is off.");
  };

  if (!loaded) return null;
  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-semibold">Two-step verification</h2>
        <p className="text-xs text-zinc-500">Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) to every sign-in. Strongly recommended for agency admins.</p>
      </div>
      {factorId ? (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm">
          <span className="font-semibold text-emerald-800">On</span>
          <button className="btn-danger" onClick={remove}>Turn off</button>
        </div>
      ) : enrol ? (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm">1. Scan this with your authenticator app:</p>
          <img src={enrol.qr} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 rounded-lg border border-zinc-200 bg-white p-2" />
          <p className="text-center text-xs text-zinc-500">Can't scan? Enter this key: <span className="select-all font-mono">{enrol.secret}</span></p>
          <p className="text-sm">2. Type the 6-digit code it shows:</p>
          <input className="input text-center font-mono text-xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
            value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} required />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || code.replace(/\s/g, "").length < 6}>{busy ? "Checking…" : "Turn on"}</button>
            <button type="button" className="btn-ghost" onClick={async () => { await supabase.auth.mfa.unenroll({ factorId: enrol.id }); setEnrol(null); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn-primary" disabled={busy} onClick={start}>Set up two-step verification</button>
      )}
      {msg && <p className="text-sm text-zinc-600">{msg}</p>}
    </div>
  );
}

/** Admin only: automatic backup status and a download button. */
function Backups() {
  const [status, setStatus] = useState<{ last_backup: string | null; kept: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { api<{ last_backup: string | null; kept: number }>("backup_status").then(setStatus).catch((e) => setErr(e.message)); }, []);

  const download = async () => {
    setBusy(true); setErr("");
    try {
      const blob = await api<Blob>("backup_download");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `email-video-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-semibold">Backups</h2>
        <p className="text-xs text-zinc-500">A full copy of organisations, branding, video page settings, fixtures, stats and client logins is saved automatically once a week (the last 8 are kept). The videos themselves are stored separately on Cloudflare.</p>
      </div>
      <p className="text-sm">
        Last automatic backup:{" "}
        <strong>{status ? (status.last_backup ? new Date(status.last_backup).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "not yet, the first runs on the next Mon/Wed/Fri") : "…"}</strong>
        {status && status.kept > 0 && <span className="text-zinc-500"> · {status.kept} kept</span>}
      </p>
      <button className="btn-ghost" disabled={busy} onClick={download}>{busy ? "Preparing…" : "Download a backup now"}</button>
      <p className="text-xs text-zinc-500">Tip: download one every month or so and keep it somewhere safe (e.g. your Google Drive) as an off-site copy.</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
