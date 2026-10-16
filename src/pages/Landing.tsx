import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { passwordProblem } from "./Auth";
import { Turnstile, turnstileEnabled } from "../components/Turnstile";
import { LEGAL, PRODUCT, TERMS_VERSION, TRIAL } from "../product";

type Mode = "signin" | "signup" | "forgot" | "check-email" | "reset-sent";

export default function Landing({ initial = "signin" }: { initial?: "signin" | "signup" }) {
  const { session, loading, needsMfa } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  useEffect(() => {
    document.title = `${PRODUCT.name}: ${PRODUCT.tagline}`;
    api<{ needsSetup: boolean }>("setup_status").then((r) => setNeedsSetup(r.needsSetup)).catch(() => {});
  }, []);

  if (!loading && session && needsMfa) return <Navigate to="/verify" replace />;
  if (!loading && session) return <Navigate to="/" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;

  return (
    <div className="min-h-screen bg-white font-sans text-plum">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <a href="#account" className="rounded-lg px-3 py-2 text-sm font-semibold text-plum hover:bg-lilac lg:hidden">Sign in</a>
      </header>

      <main>
        {/* Hero + account card */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:pt-10">
          <div>
            <h1 className="max-w-[16ch] font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.02em] sm:text-6xl">
              Send video in every email, on a page that looks like yours.
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-plum-soft">
              Upload a video, brand the page it plays on, and link to it from any email platform.
              Choose when it goes live and when it switches off, then see who watched and what they tapped.
            </p>
          </div>

          <div id="account" className="scroll-mt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-8 lg:self-start">
            <AuthCard initial={initial} />
          </div>

          <div className="lg:col-start-1 lg:row-start-2 lg:-mt-10">
            <HeroVisual />
          </div>
        </section>

        {/* How it works: a real sequence, so it's numbered */}
        <section className="border-t border-plum-line bg-lilac/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-[-0.01em] sm:text-4xl">How it works</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative pl-12">
                  <span className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-plum font-display text-base font-bold text-rec">{i + 1}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-plum-soft">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What's included */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="max-w-[24ch] font-display text-3xl font-bold tracking-[-0.01em] sm:text-4xl">Made for messages that should feel personal</h2>
          <p className="mt-3 max-w-[60ch] text-plum-soft">
            Birthday messages from the squad, behind-the-scenes clips for subscribers, thank-yous after a big night.
            One video, sent to thousands, that still feels like it was meant for each person.
          </p>
          <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="border-t-2 border-plum pt-4">
                <dt className="font-semibold">{f.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-plum-soft">{f.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-plum px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <h2 className="font-display text-2xl font-bold">Try it free</h2>
              <p className="mt-1 text-white/75">
                {TRIAL.videos} videos up to {TRIAL.maxMinutes} minutes each, and {TRIAL.playsPerMonth} plays a month. No card needed.
              </p>
            </div>
            <a href="#account" onClick={() => window.dispatchEvent(new Event("show-signup"))}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-rec px-5 py-3 font-semibold text-plum hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rec">
              Create an account
            </a>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}

const STEPS = [
  { title: "Upload your video", body: "Drop in an MP4 or MOV from your phone or editor. It's converted to play smoothly on any device." },
  { title: "Make the page yours", body: "Add your logo, colours and font, a headline and message, plus buttons, images or upcoming fixtures." },
  { title: "Link it from your email", body: "Copy the page link into a button in Mailchimp, Dotdigital, Klaviyo or any email platform." },
  { title: "See how it did", body: "Plays, watch time and button taps update as people watch. Share a live report link with your client." },
];

const FEATURES = [
  { title: "Your brand, not ours", body: "Every page uses your logo, colours and font. There's no player branding or “powered by” badge." },
  { title: "Live when you say", body: "Schedule a start time, set an expiry, or switch a page off instantly. Expired links show your own message." },
  { title: "No public view counts", body: "Viewers never see how many others watched, so a message sent to 10,000 people still feels personal." },
  { title: "More than a video", body: "Add text, ticket buttons, an image and match fixtures underneath, so the page keeps working after the video ends." },
  { title: "Stats you can act on", body: "See plays, unique viewers, average watch time and every button tap, and export it as a spreadsheet." },
  { title: "Private by design", body: "Viewers are counted anonymously, with no names, emails or advertising cookies, and they can opt out in one tap." },
];

/* ---------------- hero picture: an email button leading to a branded page ---------------- */

function HeroVisual() {
  return (
    <div className="relative mt-2 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-start sm:gap-0" aria-hidden="true">
      {/* the email */}
      <div className="w-full max-w-[300px] rounded-2xl border border-plum-line bg-white p-5 shadow-[0_18px_40px_-24px_rgba(36,19,50,0.45)] sm:mb-24 sm:mr-[-28px] sm:rotate-[-3deg]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0E3B5C] text-xs font-bold text-white">HC</span>
          <div className="min-w-0 text-xs leading-tight">
            <div className="font-semibold">Harbour City FC</div>
            <div className="text-plum-soft">A birthday message for you</div>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="h-2 w-[92%] rounded bg-plum/10" />
          <div className="h-2 w-[80%] rounded bg-plum/10" />
          <div className="h-2 w-[60%] rounded bg-plum/10" />
        </div>
        <div className="mt-4 rounded-lg bg-[#0E3B5C] py-2.5 text-center text-sm font-semibold text-white">Watch your message</div>
      </div>

      {/* the page it opens */}
      <div className="relative z-10">
        <div className="w-[236px] rounded-[2.2rem] bg-plum p-2.5 shadow-[0_30px_60px_-28px_rgba(36,19,50,0.7)]">
          <div className="overflow-hidden rounded-[1.7rem] bg-[#0E3B5C] px-3.5 pb-5 pt-6 text-white">
            <div className="text-center font-display text-sm font-bold tracking-wide">Harbour City FC</div>
            <div className="mt-3 text-center font-display text-[15px] font-bold leading-tight">Happy birthday from the squad</div>
            <div className="relative mt-3 aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-[#2A6F97] to-[#06243A]">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 text-[#0E3B5C]" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="mx-auto h-1.5 w-[85%] rounded bg-white/25" />
              <div className="mx-auto h-1.5 w-[65%] rounded bg-white/25" />
            </div>
            <div className="mt-3.5 rounded-md bg-[#F2B705] py-2 text-center text-[11px] font-bold text-[#0E3B5C]">Get match tickets</div>
            <div className="mt-3 flex items-center gap-2 rounded-md bg-white/10 p-2">
              <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded bg-[#F2B705] text-[#0E3B5C]">
                <span className="text-[11px] font-bold leading-none">14</span>
                <span className="text-[7px] font-bold leading-none">NOV</span>
              </div>
              <div className="text-[10px] leading-tight">
                <div className="font-semibold">vs Northgate Rovers</div>
                <div className="opacity-70">Kick-off 15:00</div>
              </div>
            </div>
          </div>
        </div>
        <ExpiryChip />
      </div>
    </div>
  );
}

/** The one moving thing on the page: the link really does switch itself off. */
function ExpiryChip() {
  const [left, setLeft] = useState(() => 24 * 3600 - 19);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s <= 1 ? 24 * 3600 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = String(Math.floor(left / 3600)).padStart(2, "0");
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return (
    <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-rec px-3.5 py-1.5 text-xs font-semibold text-plum shadow-md">
      <span className="h-2 w-2 rounded-full bg-[#D7263D] motion-safe:animate-pulse" />
      Switches off in <span className="tabular-nums">{h}:{m}:{s}</span>
    </div>
  );
}

/* ---------------- sign in / create account ---------------- */

function friendlyAuthError(msg: string) {
  if (/signups? not allowed|signup.*disabled/i.test(msg)) return "Sign-ups aren't open yet. Please check back soon.";
  if (/captcha/i.test(msg)) return "Please complete the security check and try again.";
  if (/rate limit|too many/i.test(msg)) return "Too many attempts. Please wait a few minutes and try again.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email address first. Check your inbox for the link we sent.";
  if (/invalid login|invalid credentials/i.test(msg)) return "That email and password don't match.";
  if (/password/i.test(msg)) return msg;
  return "Something went wrong. Please try again.";
}

function AuthCard({ initial }: { initial: "signin" | "signup" }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [terms, setTerms] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const show = () => { setMode("signup"); setErr(""); };
    window.addEventListener("show-signup", show);
    return () => window.removeEventListener("show-signup", show);
  }, []);

  const switchTo = (m: Mode) => { setMode(m); setErr(""); setCaptchaReset((n) => n + 1); };
  const captchaOk = !turnstileEnabled || !!captcha;
  const pwProblem = mode === "signup" && password ? passwordProblem(password, email) : null;
  const finish = () => { setBusy(false); setCaptchaReset((n) => n + 1); };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captcha ?? undefined } });
    if (error) { finish(); setErr(friendlyAuthError(error.message)); return; }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setBusy(false);
    nav(aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" ? "/verify" : "/");
  };

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    if (pwProblem || !terms) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        captchaToken: captcha ?? undefined,
        data: {
          full_name: name.trim().slice(0, 100),
          organisation: orgName.trim().slice(0, 80),
          terms_version: TERMS_VERSION,
          terms_accepted_at: new Date().toISOString(),
          product_updates: updates,
        },
      },
    });
    if (error) { finish(); setErr(friendlyAuthError(error.message)); return; }
    setBusy(false);
    if (data.session) { nav("/"); return; } // email confirmation switched off
    setMode("check-email");
  };

  const forgot = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
      captchaToken: captcha ?? undefined,
    });
    if (error && !/user not found/i.test(error.message)) { finish(); setErr(friendlyAuthError(error.message)); return; }
    setBusy(false);
    setMode("reset-sent");
  };

  return (
    <div className="rounded-2xl border border-plum-line bg-white p-6 shadow-[0_24px_60px_-36px_rgba(36,19,50,0.5)] sm:p-7">
      {(mode === "signin" || mode === "signup") && (
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-lilac p-1 text-sm font-semibold" role="tablist">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchTo(m)}
              className={`rounded-lg py-2 transition-colors ${mode === m ? "bg-white text-plum shadow-sm" : "text-plum-soft hover:text-plum"}`}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      {mode === "signin" && (
        <form onSubmit={signIn} className="space-y-4">
          <Field label="Email"><input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password" aside={<button type="button" className="text-xs font-semibold text-plum-soft underline-offset-2 hover:text-plum hover:underline" onClick={() => switchTo("forgot")}>Forgotten it?</button>}>
            <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
          {err && <ErrorText>{err}</ErrorText>}
          <Submit disabled={busy || !captchaOk}>{busy ? "Signing in…" : "Sign in"}</Submit>
        </form>
      )}

      {mode === "signup" && (
        <form onSubmit={signUp} className="space-y-4">
          <Field label="Your name"><input className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></Field>
          <Field label="Work email"><input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Organisation"><input className="field" autoComplete="organization" placeholder="e.g. Harbour City FC" value={orgName} onChange={(e) => setOrgName(e.target.value)} required maxLength={80} /></Field>
          <Field label="Password">
            <input className="field" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <span className={`mt-1.5 block text-xs ${pwProblem ? "text-amber-700" : "text-plum-soft"}`}>{pwProblem ?? "At least 12 characters, mixing letters, numbers or symbols."}</span>
          </Field>

          <label className="flex items-start gap-3 text-sm leading-snug">
            <input type="checkbox" className="check" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
            <span>I agree to the <Link to="/terms" target="_blank" className="font-semibold underline underline-offset-2">terms of service</Link> and have read the <Link to="/privacy" target="_blank" className="font-semibold underline underline-offset-2">privacy notice</Link>.</span>
          </label>
          <label className="flex items-start gap-3 text-sm leading-snug text-plum-soft">
            <input type="checkbox" className="check" checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
            <span>Email me occasional product news and tips. Optional, and you can unsubscribe at any time.</span>
          </label>

          <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
          {err && <ErrorText>{err}</ErrorText>}
          <Submit disabled={busy || !terms || !!pwProblem || !captchaOk}>{busy ? "Creating your account…" : "Create account"}</Submit>
          <p className="text-center text-xs text-plum-soft">Free trial. No card needed. We'll email you a link to confirm your address.</p>
        </form>
      )}

      {mode === "forgot" && (
        <form onSubmit={forgot} className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold">Reset your password</h2>
            <p className="mt-1 text-sm text-plum-soft">Enter your account email and we'll send you a link to choose a new password.</p>
          </div>
          <Field label="Email"><input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
          {err && <ErrorText>{err}</ErrorText>}
          <Submit disabled={busy || !captchaOk}>{busy ? "Sending…" : "Send reset link"}</Submit>
          <BackLink onClick={() => switchTo("signin")} />
        </form>
      )}

      {(mode === "check-email" || mode === "reset-sent") && (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lilac">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg>
          </div>
          <h2 className="font-display text-xl font-bold">Check your email</h2>
          <p className="text-sm leading-relaxed text-plum-soft">
            {mode === "check-email"
              ? <>We've sent a link to <strong className="text-plum">{email}</strong>. Open it to confirm your address and finish setting up your account.</>
              : <>If <strong className="text-plum">{email}</strong> has an account, a reset link is on its way. It works once and expires after an hour.</>}
          </p>
          <p className="text-xs text-plum-soft">Nothing after a few minutes? Check your spam folder.</p>
          <BackLink onClick={() => switchTo("signin")} />
        </div>
      )}
    </div>
  );
}

function Field({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        {aside}
      </span>
      {children}
    </label>
  );
}

function Submit({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button disabled={disabled}
      className="w-full rounded-xl bg-plum py-3 font-semibold text-white transition hover:bg-[#33204A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </button>
  );
}

const ErrorText = ({ children }: { children: ReactNode }) => <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;

const BackLink = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="mx-auto block text-sm font-semibold text-plum-soft hover:text-plum">Back to sign in</button>
);

/* ---------------- shared bits ---------------- */

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link to="/login" className="flex items-center gap-2.5 font-display font-bold text-plum">
      <span className={`relative flex items-center justify-center rounded-xl bg-plum ${small ? "h-7 w-7" : "h-9 w-9"}`}>
        <svg viewBox="0 0 24 24" className={`${small ? "h-3.5 w-3.5" : "h-4 w-4"} ml-0.5 text-white`} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rec" />
      </span>
      <span className={small ? "text-lg" : "text-xl"}>{PRODUCT.name}</span>
    </Link>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-plum-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-plum-soft sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-[60ch] space-y-1">
          <p>{PRODUCT.name} is run by {LEGAL.company}, {LEGAL.address}.</p>
          {(LEGAL.companyNumber || LEGAL.icoNumber) && (
            <p>{[LEGAL.companyNumber, LEGAL.icoNumber && `ICO registration ${LEGAL.icoNumber}`].filter(Boolean).join(". ")}</p>
          )}
          {LEGAL.contactEmail && <p>Questions or data requests: <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a></p>}
        </div>
        <nav className="flex gap-5 font-semibold">
          <Link to="/privacy" className="hover:text-plum">Privacy</Link>
          <Link to="/terms" className="hover:text-plum">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
