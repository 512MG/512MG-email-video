import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, slugify, supabase, type Org } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { PRODUCT, TRIAL } from "../product";

export default function Orgs() {
  const { isAdmin } = useAuth();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("organisations").select("*").order("name");
    setOrgs((data as Org[]) ?? []);
    const { data: vids } = await supabase.from("videos").select("org_id");
    const c: Record<string, number> = {};
    (vids ?? []).forEach((v: any) => (c[v.org_id] = (c[v.org_id] ?? 0) + 1));
    setCounts(c);
  };
  useEffect(() => { load(); }, []);

  if (orgs === null) return null;
  if (!isAdmin && orgs.length === 1) return <Navigate to={`/o/${orgs[0].id}`} replace />;
  if (!isAdmin && orgs.length === 0) return <CreateWorkspace onCreated={load} />;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    const s = slugify(slug || name);
    const { error } = await supabase.from("organisations").insert({ name: name.trim(), slug: s, plan: "agency" });
    if (error) { setErr(error.message.includes("duplicate") ? "That web address is already taken." : error.message); return; }
    setName(""); setSlug(""); setSlugTouched(false); setOpen(false);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organisations</h1>
          <p className="text-sm text-zinc-500">Each organisation has its own branding, videos and logins.</p>
        </div>
        {isAdmin && <button className="btn-primary" onClick={() => setOpen(!open)}>+ New organisation</button>}
      </div>

      {open && (
        <form onSubmit={create} className="card mb-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} placeholder="e.g. Belle Vue Coaches" required />
          </div>
          <div>
            <label className="label">Web address</label>
            <div className="flex items-center rounded-lg border border-zinc-300 bg-zinc-50 pl-3 text-sm text-zinc-500">
              /v/<input className="w-full rounded-r-lg border-0 bg-white px-1 py-2 text-ink outline-none" value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} required />
            </div>
          </div>
          <button className="btn-primary">Create</button>
          {err && <p className="text-sm text-red-600 sm:col-span-3">{err}</p>}
        </form>
      )}

      {orgs.length === 0 ? (
        <div className="card text-center text-sm text-zinc-500">
          {isAdmin ? "No organisations yet. Create the first one above." : "You haven't been added to an organisation yet. Ask your account manager."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => (
            <Link key={o.id} to={`/o/${o.id}`} className="card group flex items-center gap-4 transition hover:border-zinc-400">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: o.bg_color }}>
                {o.logo_url ? <img src={o.logo_url} alt="" className="max-h-10 max-w-10 object-contain" /> : <span className="font-bold" style={{ color: o.text_color }}>{o.name[0]}</span>}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold group-hover:underline">{o.name}</div>
                <div className="text-xs text-zinc-500">/v/{o.slug} · {counts[o.id] ?? 0} video{(counts[o.id] ?? 0) === 1 ? "" : "s"}</div>
                {isAdmin && o.plan !== "agency" && (
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${o.plan === "trial" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {o.plan === "trial" ? "Self-serve trial" : "Standard plan"}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** First visit after confirming a self-serve sign-up: name the workspace. */
function CreateWorkspace({ onCreated }: { onCreated: () => void }) {
  const { session } = useAuth();
  const [name, setName] = useState<string>(String(session?.user.user_metadata?.organisation ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("create_workspace", { name });
      onCreated();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md pt-6">
      <h1 className="text-2xl font-bold">Welcome to {PRODUCT.name}</h1>
      <p className="mt-1 text-sm text-zinc-600">Your email is confirmed. Name your workspace and you're ready to upload your first video.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4">
        <div>
          <label className="label">Organisation name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harbour City FC" required minLength={2} maxLength={80} autoFocus />
          <p className="mt-1 text-xs text-zinc-500">Shown on your video pages and used in their web address.</p>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || name.trim().length < 2}>{busy ? "Creating…" : "Create workspace"}</button>
        <p className="text-center text-xs text-zinc-500">Free trial: {TRIAL.videos} videos up to {TRIAL.maxMinutes} minutes each, {TRIAL.playsPerMonth} plays a month.</p>
      </form>
    </div>
  );
}
