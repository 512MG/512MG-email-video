import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { passwordProblem } from "./Auth";
import { Wordmark } from "./Landing";

/** Opened from the "reset your password" email: the link signs the person in, then they choose a new password. */
export default function Reset() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(false);

  // The sign-in from the email link can take a moment to arrive
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);

  const problem = pw ? passwordProblem(pw, session?.user.email ?? undefined) : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    if (pw !== pw2) { setErr("The two passwords don't match."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(/same/i.test(error.message) ? "Choose a password you haven't used before." : error.message); return; }
    nav("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-lilac/60 font-sans text-plum">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6"><Wordmark /></header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 sm:pt-16">
        <div className="w-full max-w-sm rounded-2xl border border-plum-line bg-white p-6 shadow-sm sm:p-7">
          {session ? (
            <form onSubmit={save} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
                <p className="mt-1 text-sm text-plum-soft">For {session.user.email}</p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">New password</span>
                <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} required autoFocus />
                <span className={`mt-1.5 block text-xs ${problem ? "text-amber-700" : "text-plum-soft"}`}>{problem ?? "At least 12 characters, mixing letters, numbers or symbols."}</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Type it again</span>
                <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }} required />
              </label>
              {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
              <button disabled={busy || !!problem || !pw}
                className="w-full rounded-xl bg-plum py-3 font-semibold text-white hover:bg-[#33204A] disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          ) : loading || !waited ? (
            <p className="text-center text-sm text-plum-soft">Checking your link…</p>
          ) : (
            <div className="space-y-3 text-center">
              <h1 className="font-display text-2xl font-bold">This link has expired</h1>
              <p className="text-sm text-plum-soft">Reset links work once and only for an hour. Ask for a new one from the sign-in page.</p>
              <Link to="/login" className="inline-block font-semibold underline">Back to sign in</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
