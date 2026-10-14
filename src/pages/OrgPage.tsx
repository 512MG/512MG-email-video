import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, fmtDate, fmtDuration, liveState, supabase, type Membership, type Org, type Stat, type Video } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import BrandEditor from "../components/BrandEditor";
import { Badge } from "../components/Badge";

export default function OrgPage() {
  const { orgId = "" } = useParams();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") ?? "videos";
  const [org, setOrg] = useState<Org | null>(null);

  const loadOrg = async () => {
    const { data } = await supabase.from("organisations").select("*").eq("id", orgId).maybeSingle();
    setOrg(data as Org);
  };
  useEffect(() => { loadOrg(); }, [orgId]);

  if (!org) return null;
  const tabs = [["videos", "Videos"], ["brand", "Brand"], ...(isAdmin ? [["people", "People"]] : [])];

  return (
    <div>
      {isAdmin && <Link to="/" className="text-sm text-zinc-500 hover:text-ink">← All organisations</Link>}
      <div className="mt-2 mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg" style={{ background: org.bg_color }}>
          {org.logo_url ? <img src={org.logo_url} alt="" className="max-h-8 max-w-8 object-contain" /> : <span className="font-bold" style={{ color: org.text_color }}>{org.name[0]}</span>}
        </div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
      </div>
      <div className="mb-6 flex gap-1 border-b border-zinc-200">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setSearch({ tab: k })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-ink text-ink" : "border-transparent text-zinc-500 hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "videos" && <VideosTab org={org} />}
      {tab === "brand" && <BrandEditor org={org} onSaved={loadOrg} />}
      {tab === "people" && isAdmin && <PeopleTab org={org} />}
    </div>
  );
}

function VideosTab({ org }: { org: Org }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("videos").select("*").eq("org_id", org.id).order("created_at", { ascending: false });
    setVideos((data as Video[]) ?? []);
    const { data: s } = await supabase.rpc("video_stats", { p_org: org.id });
    const m: Record<string, Stat> = {};
    (s ?? []).forEach((r: Stat) => (m[r.video_id] = r));
    setStats(m);
  };
  useEffect(() => { load(); }, [org.id]);

  // Poll videos that are still processing
  useEffect(() => {
    const pending = videos.filter((v) => v.status === "uploading" || v.status === "processing");
    if (!pending.length || progress !== null) return;
    const t = setTimeout(async () => {
      await Promise.all(pending.map((v) => api("refresh_video", { video_id: v.id }).catch(() => {})));
      load();
    }, 6000);
    return () => clearTimeout(t);
  }, [videos, progress]);

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { setErr("Files up to 200 MB for now. Export a smaller version (1080p is plenty)."); return; }
    setErr(""); setProgress(0);
    try {
      const { uploadURL } = await api<{ uploadURL: string; video: Video }>("create_upload", { org_id: org.id, title: title || file.name.replace(/\.[^.]+$/, "") });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fd = new FormData();
        fd.append("file", file);
        xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Please try again.")));
        xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
        xhr.open("POST", uploadURL);
        xhr.send(fd);
      });
      setTitle(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setProgress(null);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="card grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label">Video title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Birthday message – October" />
        </div>
        <div>
          <label className="label">Video file (MP4/MOV, up to 200 MB)</label>
          <input ref={fileRef} type="file" accept="video/*" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <button className="btn-primary" disabled={!file || progress !== null}>{progress !== null ? `Uploading ${progress}%` : "Upload"}</button>
        {progress !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 sm:col-span-3"><div className="h-full bg-ink transition-all" style={{ width: `${progress}%` }} /></div>
        )}
        {err && <p className="text-sm text-red-600 sm:col-span-3">{err}</p>}
      </form>

      {videos.length === 0 ? (
        <div className="card text-center text-sm text-zinc-500">No videos yet. Upload the first one above.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="px-4 py-3">Video</th><th className="px-4 py-3">Status</th><th className="hidden px-4 py-3 md:table-cell">Live window</th><th className="px-4 py-3 text-right">Plays</th><th className="hidden px-4 py-3 text-right sm:table-cell">Avg watched</th></tr>
            </thead>
            <tbody>
              {videos.map((v) => {
                const s = liveState(v);
                const st = stats[v.id];
                return (
                  <tr key={v.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link to={`/o/${org.id}/v/${v.id}`} className="font-semibold hover:underline">{v.title}</Link>
                      <div className="text-xs text-zinc-500">{fmtDuration(v.duration)} · added {fmtDate(v.created_at)}</div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className="hidden px-4 py-3 text-xs text-zinc-500 md:table-cell">
                      {v.live_from || v.live_until ? <>{v.live_from ? fmtDate(v.live_from) : "Now"} → {v.live_until ? fmtDate(v.live_until) : "no end"}</> : "Always on"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{st?.plays ?? 0}</td>
                    <td className="hidden px-4 py-3 text-right sm:table-cell">{fmtDuration(st?.avg_seconds)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PeopleTab({ org }: { org: Org }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");
  const [result, setResult] = useState<{ email: string; password: string | null } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("memberships").select("*").eq("org_id", org.id).order("created_at");
    setMembers((data as Membership[]) ?? []);
  };
  useEffect(() => { load(); }, [org.id]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await api<{ email: string; password: string | null }>("create_user", { org_id: org.id, email, role });
      setResult(r); setEmail(""); load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (m: Membership) => {
    if (!confirm(`Remove ${m.email} from ${org.name}?`)) return;
    await api("remove_member", { org_id: org.id, user_id: m.user_id });
    load();
  };

  const reset = async (m: Membership) => {
    if (!confirm(`Give ${m.email} a new password? Their old one will stop working.`)) return;
    const r = await api<{ password: string }>("reset_password", { user_id: m.user_id });
    setResult({ email: m.email ?? "", password: r.password });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div><label className="label">Add a client login</label><input className="input" type="email" placeholder="name@client.co.uk" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}><option value="member">Member</option><option value="owner">Owner</option></select>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? "Adding…" : "Add person"}</button>
        {err && <p className="text-sm text-red-600 sm:col-span-3">{err}</p>}
      </form>

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          {result.password ? (
            <>
              <p className="font-semibold text-emerald-900">Login ready for {result.email}. Send them these details (the password is only shown once):</p>
              <pre className="mt-2 select-all whitespace-pre-wrap rounded-lg bg-white p-3 font-mono text-xs text-ink">{`Sign in: ${window.location.origin}/login\nEmail: ${result.email}\nPassword: ${result.password}\n\nYou can change your password under Account once signed in.`}</pre>
            </>
          ) : (
            <p className="text-emerald-900">{result.email} already had a login, so they've been given access to {org.name}. Their password hasn't changed.</p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {members.length === 0 ? <p className="p-5 text-sm text-zinc-500">No client logins yet. Agency admins can always see this organisation.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-t border-zinc-100 first:border-0">
                  <td className="px-4 py-3 font-medium">{m.email}</td>
                  <td className="px-4 py-3 text-zinc-500 capitalize">{m.role}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="mr-3 text-xs font-semibold text-zinc-600 hover:text-ink" onClick={() => reset(m)}>Reset password</button>
                    <button className="text-xs font-semibold text-red-600 hover:text-red-800" onClick={() => remove(m)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
