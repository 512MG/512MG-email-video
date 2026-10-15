import { useState } from "react";
import { supabase, type Org, type Sponsor } from "../lib/supabase";

const MAX = 12;

function normaliseUrl(u: string) {
  const s = u.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** Sponsor logos for an organisation. Each video can choose to show them. */
export default function SponsorsEditor({ org, onSaved }: { org: Org; onSaved: () => void }) {
  const [list, setList] = useState<Sponsor[]>(org.sponsors ?? []);
  const [title, setTitle] = useState(org.sponsors_title || "Our partners");
  const [busy, setBusy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const dirty = JSON.stringify(list) !== JSON.stringify(org.sponsors ?? []) || title !== (org.sponsors_title || "Our partners");

  const update = (i: number, patch: Partial<Sponsor>) => { setList((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s))); setMsg(""); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  const upload = async (i: number, file: File) => {
    setErr("");
    if (!file.type.startsWith("image/")) { setErr("That isn't an image."); return; }
    if (file.size > 10 * 1024 * 1024) { setErr("Logo is over 10 MB."); return; }
    setBusy(i);
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${org.id}/sponsor-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("brand").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setBusy(null);
    if (error) { setErr(`Upload failed: ${error.message}`); return; }
    update(i, { logo_url: supabase.storage.from("brand").getPublicUrl(path).data.publicUrl });
  };

  const save = async () => {
    setErr("");
    if (list.some((s) => !s.logo_url)) { setErr("Every sponsor needs a logo (or remove it)."); return; }
    setSaving(true);
    const clean = list.map((s) => ({ name: s.name.trim(), logo_url: s.logo_url, url: normaliseUrl(s.url) }));
    const { error } = await supabase.from("organisations").update({ sponsors: clean, sponsors_title: title.trim() || "Our partners" }).eq("id", org.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setList(clean);
    setMsg("Saved. Videos with “Show sponsors” ticked now show these.");
    onSaved();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="card space-y-4">
        <div>
          <h3 className="font-semibold">Sponsors</h3>
          <p className="text-xs text-zinc-500">Logos shown in a strip under the video. Turn them on per video in "What viewers see". Clicks on each logo are counted in Stats.</p>
        </div>
        <div className="max-w-sm">
          <label className="label">Heading above the logos</label>
          <input className="input" value={title} onChange={(e) => { setTitle(e.target.value); setMsg(""); }} placeholder="Our partners" />
        </div>

        <div className="space-y-2">
          {list.map((s, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center">
              <label className={`flex h-14 w-28 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-1 text-xs text-zinc-500 hover:border-zinc-500 ${busy === i ? "opacity-50" : ""}`}>
                {busy === i ? "Uploading…" : s.logo_url ? <img src={s.logo_url} alt="" className="max-h-full max-w-full object-contain" /> : "Add logo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(i, f); }} />
              </label>
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <input className="input" placeholder="Sponsor name" value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
                <input className="input" placeholder="Website (optional)" value={s.url} onChange={(e) => update(i, { url: e.target.value })} onBlur={(e) => update(i, { url: normaliseUrl(e.target.value) })} />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button type="button" className="h-7 w-7 rounded font-bold text-zinc-600 hover:bg-white disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
                <button type="button" className="h-7 w-7 rounded font-bold text-zinc-600 hover:bg-white disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
                <button type="button" className="rounded px-2 py-1 font-semibold text-red-600 hover:bg-red-50" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        {list.length < MAX && <button type="button" className="btn-ghost" onClick={() => setList([...list, { name: "", logo_url: "", url: "" }])}>+ Add a sponsor</button>}

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : dirty ? "Save sponsors" : "Saved"}</button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>
    </div>
  );
}
