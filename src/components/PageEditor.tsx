import { useEffect, useState } from "react";
import type { Org, Video } from "../lib/supabase";
import { BrandedPage, VideoPageContent, VideoPlaceholder, type PageButton } from "./BrandedPage";

const MAX_BUTTONS = 6;

type Draft = { title: string; headline: string; message: string; body: string; buttons: PageButton[] };

const fromVideo = (v: Video): Draft => ({
  title: v.title,
  headline: v.headline ?? "",
  message: v.message ?? "",
  body: v.body ?? "",
  buttons: (v.buttons ?? []).map((b) => ({ label: b.label ?? "", url: b.url ?? "", style: b.style === "secondary" ? "secondary" : "primary" })),
});

function normaliseUrl(u: string) {
  const s = u.trim();
  if (!s) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) return s;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `mailto:${s}`;
  return `https://${s}`;
}

/** Everything a viewer sees on this video's page, with a live preview. */
export default function PageEditor({ org, video, onSave }: { org: Org; video: Video; onSave: (p: Partial<Video>) => Promise<boolean> }) {
  const [d, setD] = useState<Draft>(fromVideo(video));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => { setD(fromVideo(video)); }, [video.id]);

  const original = JSON.stringify(fromVideo(video));
  const dirty = JSON.stringify(d) !== original;

  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => { setD((p) => ({ ...p, [k]: val })); setErr(""); };
  const setBtn = (i: number, patch: Partial<PageButton>) => set("buttons", d.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const addBtn = () => set("buttons", [...d.buttons, { label: "", url: "", style: d.buttons.length === 0 ? "primary" : "secondary" }]);
  const removeBtn = (i: number) => set("buttons", d.buttons.filter((_, j) => j !== i));
  const moveBtn = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.buttons.length) return;
    const next = [...d.buttons];
    [next[i], next[j]] = [next[j], next[i]];
    set("buttons", next);
  };

  const save = async () => {
    const half = d.buttons.find((b) => (b.label.trim() && !b.url.trim()) || (!b.label.trim() && b.url.trim()));
    if (half) { setErr("Each button needs both text and a link (or remove it)."); return; }
    setSaving(true);
    const buttons = d.buttons
      .filter((b) => b.label.trim() && b.url.trim())
      .map((b) => ({ label: b.label.trim(), url: normaliseUrl(b.url), style: b.style }));
    const ok = await onSave({
      title: d.title.trim() || video.title,
      headline: d.headline.trim() || null,
      message: d.message.trim() || null,
      body: d.body.trim() || null,
      buttons,
    });
    setSaving(false);
    if (ok) { setD({ ...d, buttons }); setSavedAt(Date.now()); }
  };

  const brand = { name: org.name, logo_url: org.logo_url, bg_color: org.bg_color, text_color: org.text_color, accent_color: org.accent_color, font: org.font };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div>
          <label className="label">Video name <span className="normal-case text-zinc-400">(dashboard only)</span></label>
          <input className="input" value={d.title} onChange={(e) => set("title", e.target.value)} />
        </div>

        <Group title="Above the video">
          <Field label="Headline" hint="Optional">
            <input className="input" value={d.headline} onChange={(e) => set("headline", e.target.value)} placeholder="e.g. Happy birthday from all of us!" />
          </Field>
          <Field label="Short message" hint="Optional">
            <textarea className="input" rows={2} value={d.message} onChange={(e) => set("message", e.target.value)} placeholder="One or two lines introducing the video" />
          </Field>
        </Group>

        <Group title="Below the video">
          <Field label="Extra text" hint="Optional. Blank lines start a new paragraph. Web links become clickable.">
            <textarea className="input" rows={5} value={d.body} onChange={(e) => set("body", e.target.value)}
              placeholder={"e.g. Thanks for being part of the club this season.\n\nTickets for the next home game are on sale now."} />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Buttons <span className="normal-case text-zinc-400">(optional, up to {MAX_BUTTONS})</span></span>
            </div>
            <div className="space-y-2">
              {d.buttons.map((b, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                    <input className="input" value={b.label} onChange={(e) => setBtn(i, { label: e.target.value })} placeholder="Button text, e.g. Buy tickets" maxLength={60} />
                    <input className="input" value={b.url} onChange={(e) => setBtn(i, { url: e.target.value })} onBlur={(e) => setBtn(i, { url: normaliseUrl(e.target.value) })} placeholder="Link, e.g. tickets.club.co.uk" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex rounded-md bg-white p-0.5 ring-1 ring-zinc-200">
                      {(["primary", "secondary"] as const).map((st) => (
                        <button key={st} type="button" onClick={() => setBtn(i, { style: st })}
                          className={`rounded px-2.5 py-1 font-semibold ${b.style === st ? "bg-ink text-white" : "text-zinc-500"}`}>
                          {st === "primary" ? "Solid" : "Outline"}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <IconBtn label="Move up" disabled={i === 0} onClick={() => moveBtn(i, -1)}>↑</IconBtn>
                      <IconBtn label="Move down" disabled={i === d.buttons.length - 1} onClick={() => moveBtn(i, 1)}>↓</IconBtn>
                      <button type="button" className="ml-1 rounded px-2 py-1 font-semibold text-red-600 hover:bg-red-50" onClick={() => removeBtn(i)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {d.buttons.length < MAX_BUTTONS && (
              <button type="button" className="btn-ghost mt-2" onClick={addBtn}>+ Add a button</button>
            )}
          </div>
        </Group>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : dirty ? "Save page" : "Saved"}</button>
          {dirty && <button className="text-sm text-zinc-500 hover:text-ink" onClick={() => setD(fromVideo(video))}>Undo changes</button>}
          {!dirty && savedAt && <span className="text-sm text-emerald-700">Saved. Viewers see this straight away.</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <span className="label">Preview (phone)</span>
        <div className="mx-auto h-[620px] w-full max-w-[360px] overflow-auto rounded-[28px] border-[6px] border-zinc-800 shadow-lg">
          <BrandedPage compact brand={brand}>
            <VideoPageContent compact brand={brand} content={d} video={<VideoPlaceholder />} />
          </BrandedPage>
        </div>
        <p className="mt-2 text-center text-xs text-zinc-500">Anything left blank simply isn't shown.</p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="h-7 w-7 rounded font-bold text-zinc-600 hover:bg-white disabled:opacity-30">
      {children}
    </button>
  );
}
