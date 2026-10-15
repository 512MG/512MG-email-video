import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadCsv, fmtDate, fmtDuration, fromLocalInput, liveState, supabase, toLocalInput, watchUrl, type Org, type Stat, type Video } from "../lib/supabase";
import { Badge } from "../components/Badge";
import EmailImage from "../components/EmailImage";
import PageEditor from "../components/PageEditor";

type ClickRow = { kind: string; label: string; url: string | null; clicks: number; last_click: string };
type ViewRow = { id: string; started_at: string; seconds_watched: number; max_position: number; completed: boolean; device: string | null };

export default function VideoPage() {
  const { orgId = "", videoId = "" } = useParams();
  const nav = useNavigate();
  const [org, setOrg] = useState<Org | null>(null);
  const [v, setV] = useState<Video | null>(null);
  const [stat, setStat] = useState<Stat | null>(null);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [copied, setCopied] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [{ data: o }, { data: vid }] = await Promise.all([
      supabase.from("organisations").select("*").eq("id", orgId).maybeSingle(),
      supabase.from("videos").select("*").eq("id", videoId).maybeSingle(),
    ]);
    setOrg(o as Org); setV(vid as Video);
    const { data: s } = await supabase.rpc("video_stats_v2", { p_org: orgId });
    setStat(((s ?? []) as Stat[]).find((r) => r.video_id === videoId) ?? null);
    const { data: w } = await supabase.from("views").select("id, started_at, seconds_watched, max_position, completed, device").eq("video_id", videoId).order("started_at", { ascending: false }).limit(50);
    setViews((w as ViewRow[]) ?? []);
    const { data: c } = await supabase.rpc("click_breakdown", { p_video: videoId });
    setClicks((c as ClickRow[]) ?? []);
  };
  useEffect(() => { load(); }, [videoId]);

  useEffect(() => {
    if (!v) return;
    const busy = v.status === "uploading" || v.status === "processing" || !!v.pending_uid || v.captions_status === "generating";
    if (!busy) return;
    const t = setTimeout(async () => { await api("refresh_video", { video_id: v.id }).catch(() => {}); load(); }, 6000);
    return () => clearTimeout(t);
  }, [v]);

  if (!org || !v) return null;
  const url = watchUrl(org.slug, v.slug);
  const state = liveState(v);
  const snippet = v.email_image_url
    ? `<a href="${url}" target="_blank" style="text-decoration:none;"><img src="${v.email_image_url}" width="600" alt="Click to watch: ${v.title.replace(/"/g, "&quot;")}" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></a>`
    : "";

  const copy = (text: string, what: string) => { navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1800); };

  const patch = async (p: Partial<Video>, note = "Saved."): Promise<boolean> => {
    const { data, error } = await supabase.from("videos").update(p).eq("id", v.id).select("*").single();
    if (error) { setMsg(error.message); return false; }
    setV(data as Video); setMsg(note); setTimeout(() => setMsg(""), 2500);
    return true;
  };

  const del = async () => {
    if (!confirm(`Delete "${v.title}"? The link will stop working and the video is removed for good.`)) return;
    await api("delete_video", { video_id: v.id });
    nav(`/o/${org.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/o/${org.id}`} className="text-sm text-zinc-500 hover:text-ink">← {org.name}</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{v.title}</h1>
          <Badge tone={state.tone}>{state.label}</Badge>
          {msg && <span className="text-sm text-zinc-500">{msg}</span>}
        </div>
      </div>

      {v.status === "error" && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">This upload failed to process. Delete it and try uploading the file again.</div>}
      {(v.status === "uploading" || v.status === "processing") && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">The video is processing. This usually takes a minute or two. This page updates by itself.</div>}

      <Card title="What viewers see" hint="Text and buttons for this video's page. The logo, colours and font come from the Brand tab.">
        <PageEditor org={org} video={v} onSave={(p) => patch(p, "Page saved.")} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Watch page link">
          <div className="flex gap-2">
            <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button className="btn-ghost shrink-0" onClick={() => copy(url, "link")}>{copied === "link" ? "Copied" : "Copy"}</button>
          </div>
          <div className="flex gap-2">
            <a href={`${url}?preview=1`} target="_blank" rel="noopener" className="btn-ghost">Preview page</a>
            <a href={url} target="_blank" rel="noopener" className="btn-ghost">Open as a viewer</a>
          </div>
          <p className="text-xs text-zinc-500">Preview works any time and isn't counted. "Open as a viewer" shows exactly what recipients see right now.</p>
        </Card>

        <Card title="When it's live">
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
            <div>
              <div className="text-sm font-semibold">{v.switched_off ? "Switched off" : "Switched on"}</div>
              <div className="text-xs text-zinc-500">{v.switched_off ? "Everyone sees the expired page." : "Follows the times below."}</div>
            </div>
            <button onClick={() => patch({ switched_off: !v.switched_off }, v.switched_off ? "Switched back on." : "Switched off.")}
              className={v.switched_off ? "btn-primary" : "btn-danger"}>{v.switched_off ? "Switch on" : "Switch off now"}</button>
          </div>
          <TimeWindow v={v} onSave={(p) => patch(p, "Live window saved.")} />
        </Card>
      </div>

      <Card title="Video file & subtitles">
        <VideoFile v={v} org={org} onChange={(nv) => setV(nv)} onDuplicate={() => nav(`/o/${org.id}?tab=videos&copy=${v.id}`)} />
      </Card>

      <Card title="Email image & code" hint="Put this in your email. It links to the watch page.">
        <EmailImage org={org} video={v} onSaved={(u) => { setV({ ...v, email_image_url: u }); setMsg("Email image saved."); }} />
        {v.email_image_url && (
          <div className="space-y-2 border-t border-zinc-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => copy(snippet, "html")}>{copied === "html" ? "Copied" : "Copy email HTML"}</button>
              <button className="btn-ghost" onClick={() => copy(v.email_image_url!, "img")}>{copied === "img" ? "Copied" : "Copy image URL"}</button>
              <a className="btn-ghost" href={v.email_image_url} target="_blank" rel="noopener" download>Download image</a>
            </div>
            <p className="text-xs text-zinc-500">For drag-and-drop editors: add an image block with the image URL and set its link to the watch page link. Or paste the HTML into an HTML block.</p>
          </div>
        )}
      </Card>

      <Card title="Stats" hint="Only visible here. Nothing is shown to viewers.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Plays" value={String(stat?.plays ?? 0)} />
          <Stat label="Unique viewers" value={String(stat?.viewers ?? 0)} />
          <Stat label="Avg watched" value={fmtDuration(stat?.avg_seconds)} sub={v.duration ? `of ${fmtDuration(v.duration)}` : undefined} />
          <Stat label="Watched to the end" value={String(stat?.completions ?? 0)} />
        </div>
        <div>
          <h3 className="mb-2 mt-2 text-sm font-semibold">Clicks <span className="font-normal text-zinc-500">({stat?.clicks ?? 0} total)</span></h3>
          {clicks.length === 0 ? <p className="text-sm text-zinc-500">No clicks yet. Clicks on buttons, ticket links, sponsor logos and links in your text are counted here.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500"><tr><th className="py-2">Link</th><th>Type</th><th className="text-right">Clicks</th></tr></thead>
              <tbody>
                {clicks.map((c, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="py-2"><div className="font-medium">{c.label}</div>{c.url && <div className="max-w-xs truncate text-xs text-zinc-400">{c.url}</div>}</td>
                    <td className="capitalize text-zinc-500">{c.kind === "fixture" ? "Tickets" : c.kind}</td>
                    <td className="text-right font-semibold">{c.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end">
          <button className="btn-ghost" onClick={() => exportCsv(org, v, stat, views, clicks)}>Download CSV</button>
        </div>
        {views.length > 0 && (
          <><h3 className="-mb-2 mt-2 text-sm font-semibold">Recent views</h3>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500"><tr><th className="py-2">When</th><th>Device</th><th className="text-right">Watched</th></tr></thead>
            <tbody>
              {views.map((w) => (
                <tr key={w.id} className="border-t border-zinc-100">
                  <td className="py-2">{fmtDate(w.started_at)}</td>
                  <td className="capitalize text-zinc-500">{w.device ?? "–"}</td>
                  <td className="text-right">{w.completed ? "To the end" : fmtDuration(w.seconds_watched)}</td>
                </tr>
              ))}
            </tbody>
          </table></>
        )}
      </Card>

      <div className="flex justify-end"><button className="btn-danger" onClick={del}>Delete video</button></div>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section className="card space-y-4"><div><h2 className="font-semibold">{title}</h2>{hint && <p className="text-xs text-zinc-500">{hint}</p>}</div>{children}</section>;
}
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-lg bg-zinc-50 p-3"><div className="text-xs text-zinc-500">{label}</div><div className="text-2xl font-bold">{value}</div>{sub && <div className="text-xs text-zinc-400">{sub}</div>}</div>;
}

function TimeWindow({ v, onSave }: { v: Video; onSave: (p: Partial<Video>) => void }) {
  const [from, setFrom] = useState(toLocalInput(v.live_from));
  const [until, setUntil] = useState(toLocalInput(v.live_until));
  const [err, setErr] = useState("");
  useEffect(() => { setFrom(toLocalInput(v.live_from)); setUntil(toLocalInput(v.live_until)); }, [v.live_from, v.live_until]);

  const quick = (hours: number) => {
    const start = from ? new Date(from) : new Date();
    if (!from) setFrom(toLocalInput(start.toISOString()));
    setUntil(toLocalInput(new Date(start.getTime() + hours * 3600_000).toISOString()));
  };
  const save = () => {
    setErr("");
    const f = fromLocalInput(from), u = fromLocalInput(until);
    if (f && u && Date.parse(u) <= Date.parse(f)) { setErr("The end must be after the start."); return; }
    onSave({ live_from: f, live_until: u });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Goes live</label><input type="datetime-local" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /><p className="mt-1 text-xs text-zinc-400">Blank = straight away</p></div>
        <div><label className="label">Expires</label><input type="datetime-local" className="input" value={until} onChange={(e) => setUntil(e.target.value)} /><p className="mt-1 text-xs text-zinc-400">Blank = never</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Expire after:</span>
        {[24, 48, 72, 168].map((h) => <button key={h} className="rounded-full border border-zinc-300 px-2.5 py-1 font-semibold hover:bg-zinc-50" onClick={() => quick(h)}>{h === 168 ? "1 week" : `${h} hrs`}</button>)}
        <button className="rounded-full px-2.5 py-1 font-semibold text-zinc-500 hover:text-ink" onClick={() => { setFrom(""); setUntil(""); }}>Clear</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary" onClick={save}>Save live window</button>
    </div>
  );
}

function exportCsv(org: Org, v: Video, stat: Stat | null, views: ViewRow[], clicks: ClickRow[]) {
  const rows: (string | number | null)[][] = [
    ["Video", v.title], ["Link", watchUrl(org.slug, v.slug)],
    ["Plays", stat?.plays ?? 0], ["Unique viewers", stat?.viewers ?? 0], ["Avg watched (secs)", stat?.avg_seconds ?? 0],
    ["Watched to end", stat?.completions ?? 0], ["Clicks", stat?.clicks ?? 0], [],
    ["Clicks by link"], ["Link", "Type", "URL", "Clicks"],
    ...clicks.map((c) => [c.label, c.kind, c.url, c.clicks]), [],
    ["Recent views (latest 50)"], ["When", "Device", "Seconds watched", "Watched to end"],
    ...views.map((w) => [w.started_at.slice(0, 16).replace("T", " "), w.device, Math.round(Number(w.seconds_watched)), w.completed ? "Yes" : "No"]),
  ];
  downloadCsv(`${org.slug}-${v.slug}-stats.csv`, rows);
}

function VideoFile({ v, org, onChange, onDuplicate }: { v: Video; org: Org; onChange: (v: Video) => void; onDuplicate: () => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [capBusy, setCapBusy] = useState(false);

  const replace = async (file: File) => {
    if (file.size > 200 * 1024 * 1024) { setErr("Files up to 200 MB for now."); return; }
    if (!confirm("Replace this video? The link stays the same. The current video keeps playing until the new one is ready.")) return;
    setErr(""); setProgress(0);
    try {
      const { uploadURL, video } = await api<{ uploadURL: string; video: Video }>("create_upload", { org_id: org.id, replace_video_id: v.id });
      onChange(video);
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
      const r = await api<{ video: Video }>("refresh_video", { video_id: v.id });
      onChange(r.video);
    } catch (e: any) { setErr(e.message); } finally { setProgress(null); }
  };

  const cancel = async () => {
    const r = await api<{ video: Video }>("cancel_replace", { video_id: v.id });
    onChange(r.video);
  };

  const toggleCaptions = async () => {
    setCapBusy(true); setErr("");
    try {
      const r = await api<{ video: Video }>("captions", { video_id: v.id, enable: !v.captions });
      onChange(r.video);
    } catch (e: any) { setErr(e.message); } finally { setCapBusy(false); }
  };

  const capLabel = !v.captions ? "Off" : v.captions_status === "ready" ? "On" : v.captions_status === "error" ? "Failed, try turning off and on" : "Generating… (a few minutes)";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
        <div>
          <div className="text-sm font-semibold">Replace video file</div>
          <div className="text-xs text-zinc-500">{v.pending_uid ? "New file is processing. The old one plays until it's ready." : "Swap in a new file. The link and everything on the page stay the same."}</div>
        </div>
        {v.pending_uid && progress === null ? (
          <button className="btn-ghost" onClick={cancel}>Cancel replacement</button>
        ) : (
          <label className={`btn-ghost cursor-pointer ${progress !== null ? "pointer-events-none opacity-60" : ""}`}>
            {progress !== null ? `Uploading ${progress}%` : "Choose new file"}
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) replace(f); }} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
        <div>
          <div className="text-sm font-semibold">Auto subtitles (English)</div>
          <div className="text-xs text-zinc-500">Generated by Cloudflare. Viewers can switch them on or off in the player. Status: <strong>{capLabel}</strong></div>
        </div>
        <button className={v.captions ? "btn-ghost" : "btn-primary"} disabled={capBusy || v.status !== "ready"} onClick={toggleCaptions}>
          {capBusy ? "…" : v.captions ? "Turn off" : "Turn on"}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
        <div>
          <div className="text-sm font-semibold">Duplicate this page</div>
          <div className="text-xs text-zinc-500">Upload a new video with the same text, buttons, fixtures, sponsors and countdown.</div>
        </div>
        <button className="btn-ghost" onClick={onDuplicate}>Duplicate</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
