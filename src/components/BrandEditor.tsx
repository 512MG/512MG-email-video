import { useState, type ReactNode } from "react";
import { FIXTURE_SIZES, FONTS, supabase, type Org } from "../lib/supabase";
import { BrandedPage, StateMessage, VideoPageContent, VideoPlaceholder } from "./BrandedPage";

type Draft = Omit<Org, "id" | "created_at" | "slug" | "name">;

export default function BrandEditor({ org, onSaved }: { org: Org; onSaved: () => void }) {
  const [d, setD] = useState<Draft>({ ...org });
  const [previewState, setPreviewState] = useState<"live" | "not_live" | "expired">("live");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p, [k]: v })); setMsg(""); };

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState("");
  const uploadLogo = async (file: File) => {
    setLogoErr("");
    if (!file.type.startsWith("image/")) { setLogoErr("That isn't an image. Use PNG, JPG, SVG or WebP."); return; }
    if (file.size > 10 * 1024 * 1024) { setLogoErr("Logo is over 10 MB. Export a smaller version."); return; }
    setLogoBusy(true);
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${org.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("brand").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) { setLogoBusy(false); setLogoErr(`Logo upload failed: ${error.message}`); return; }
    const url = supabase.storage.from("brand").getPublicUrl(path).data.publicUrl;
    set("logo_url", url);
    // Save the logo straight away so it isn't lost if "Save branding" isn't clicked
    const { error: saveErr } = await supabase.from("organisations").update({ logo_url: url }).eq("id", org.id);
    setLogoBusy(false);
    if (saveErr) setLogoErr(`Logo uploaded but not saved: ${saveErr.message}`);
    else { setMsg("Logo saved."); onSaved(); }
  };
  const removeLogo = async () => {
    set("logo_url", null);
    await supabase.from("organisations").update({ logo_url: null }).eq("id", org.id);
    onSaved();
  };

  const save = async () => {
    setSaving(true);
    const fields: (keyof Draft)[] = ["logo_url", "bg_color", "text_color", "accent_color", "font", "corner_style",
      "fixture_badge_color", "ticket_button_color", "card_color", "fixture_size",
      "not_live_title", "not_live_message", "expired_title", "expired_message"];
    const patch: Record<string, unknown> = {};
    fields.forEach((f) => (patch[f] = typeof d[f] === "string" && (d[f] as string).trim() === "" ? null : d[f]));
    ["not_live_title", "not_live_message", "expired_title", "expired_message"].forEach((f) => { if (patch[f] === null) patch[f] = ""; });
    const { error } = await supabase.from("organisations").update(patch).eq("id", org.id);
    setSaving(false);
    setMsg(error ? error.message : "Saved. All video pages for this organisation now use this look.");
    if (!error) onSaved();
  };

  const brand = { name: org.name, logo_url: d.logo_url, bg_color: d.bg_color, text_color: d.text_color, accent_color: d.accent_color, font: d.font, corner_style: d.corner_style,
    fixture_badge_color: d.fixture_badge_color, ticket_button_color: d.ticket_button_color, card_color: d.card_color, fixture_size: d.fixture_size };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <Section title="Logo & colours">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-zinc-200" style={{ background: d.bg_color }}>
              {d.logo_url ? <img src={d.logo_url} className="max-h-10 max-w-20 object-contain" alt="" /> : <span className="text-xs" style={{ color: d.text_color }}>No logo</span>}
            </div>
            <label className={`btn-ghost cursor-pointer ${logoBusy ? "pointer-events-none opacity-50" : ""}`}>
              {logoBusy ? "Uploading…" : d.logo_url ? "Change logo" : "Upload logo"}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadLogo(f); }} />
            </label>
            {d.logo_url && !logoBusy && <button className="text-xs text-zinc-500 hover:text-ink" onClick={removeLogo}>Remove</button>}
          </div>
          {logoErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{logoErr}</p>}
          <p className="text-xs text-zinc-500">PNG with a transparent background works best. SVG, JPG and WebP are fine too.</p>
          <div className="grid grid-cols-3 gap-3">
            <Colour label="Background" value={d.bg_color} onChange={(v) => set("bg_color", v)} />
            <Colour label="Text" value={d.text_color} onChange={(v) => set("text_color", v)} />
            <Colour label="Button" value={d.accent_color} onChange={(v) => set("accent_color", v)} />
          </div>
          <div>
            <label className="label">Font</label>
            <select className="input" value={d.font} onChange={(e) => set("font", e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
          </div>
          <div>
            <label className="label">Video & button corners</label>
            <div className="grid grid-cols-2 gap-2">
              {([["rounded", "Rounded"], ["square", "Square (hard edge)"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => set("corner_style", k)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm font-semibold ${d.corner_style === k ? "border-ink bg-zinc-50" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}>
                  <span className={`h-6 w-9 border-2 border-current ${k === "rounded" ? "rounded-md" : ""}`} />
                  {l}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Fixtures & countdown" hint="Optional. Leave colours on “Auto” to match your main colours.">
          <div>
            <label className="label">Fixture text size (default for all videos)</label>
            <SizePicker value={d.fixture_size} onChange={(v) => set("fixture_size", v)} />
          </div>
          <OptionalColour label="Fixture date block" value={d.fixture_badge_color} fallback={d.accent_color} onChange={(v) => set("fixture_badge_color", v)} />
          <OptionalColour label="Tickets buttons" value={d.ticket_button_color} fallback={d.accent_color} onChange={(v) => set("ticket_button_color", v)} />
          <OptionalColour label="Fixture cards & countdown boxes" value={d.card_color} fallback={d.bg_color} onChange={(v) => set("card_color", v)} />
          <p className="text-xs text-zinc-500">Individual page buttons can have their own colour too. Set it per button on each video.</p>
        </Section>

        <Section title="When a video isn't available">
          <Field label="Not live yet – title"><input className="input" value={d.not_live_title} onChange={(e) => set("not_live_title", e.target.value)} onFocus={() => setPreviewState("not_live")} /></Field>
          <Field label="Not live yet – message"><input className="input" value={d.not_live_message} onChange={(e) => set("not_live_message", e.target.value)} onFocus={() => setPreviewState("not_live")} /></Field>
          <Field label="Expired – title"><input className="input" value={d.expired_title} onChange={(e) => set("expired_title", e.target.value)} onFocus={() => setPreviewState("expired")} /></Field>
          <Field label="Expired – message"><input className="input" value={d.expired_message} onChange={(e) => set("expired_message", e.target.value)} onFocus={() => setPreviewState("expired")} /></Field>
        </Section>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save branding"}</button>
          {msg && <span className="text-sm text-zinc-600">{msg}</span>}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">Preview</span>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs font-semibold">
            {([["live", "Video"], ["not_live", "Not live yet"], ["expired", "Expired"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setPreviewState(k)} className={`rounded-md px-2.5 py-1 ${previewState === k ? "bg-white shadow-sm" : "text-zinc-500"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="h-[560px] overflow-auto rounded-xl border border-zinc-200 shadow-sm">
          <BrandedPage compact brand={brand}>
            {previewState === "live" && (
              <VideoPageContent compact brand={brand} video={<VideoPlaceholder />}
                content={{ headline: "Example headline", message: "Each video sets its own text and buttons.", body: "", buttons: [{ label: "Example button", url: "#", style: "primary" }, { label: "Second button", url: "#", style: "secondary" }],
                  fixtures: [{ id: "x", kickoff: new Date(Date.now() + 5 * 86400000).toISOString(), title: "Example fixture", home_away: "home", competition: "League", venue: null, ticket_url: "#" }],
                  sponsors: org.sponsors?.length ? org.sponsors : undefined, sponsors_title: org.sponsors_title }} />
            )}
            {previewState === "not_live" && <StateMessage title={d.not_live_title} message={d.not_live_message} />}
            {previewState === "expired" && <StateMessage title={d.expired_title} message={d.expired_message} />}
          </BrandedPage>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <div className="card space-y-3"><div><h3 className="font-semibold">{title}</h3>{hint && <p className="text-xs text-zinc-500">{hint}</p>}</div>{children}</div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white p-1">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent font-mono text-xs outline-none" />
      </div>
    </div>
  );
}
function OptionalColour({ label, value, fallback, onChange }: { label: string; value: string | null; fallback: string; onChange: (v: string | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white p-1">
          <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
          <span className="w-16 font-mono text-xs">{value || "Auto"}</span>
        </div>
        {value && <button type="button" className="text-xs font-semibold text-zinc-500 hover:text-ink" onClick={() => onChange(null)}>Auto</button>}
      </div>
    </div>
  );
}
export function SizePicker({ value, onChange, allowDefault, defaultLabel }: { value: string; onChange: (v: any) => void; allowDefault?: boolean; defaultLabel?: string }) {
  const opts: [string, string][] = [...(allowDefault ? [["", defaultLabel ?? "Brand default"] as [string, string]] : []), ...FIXTURE_SIZES];
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 text-xs font-semibold">
      {opts.map(([k, l], i) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${value === k ? "bg-white shadow-sm" : "text-zinc-500 hover:text-ink"}`}>
          {k && <span className="font-bold" style={{ fontSize: 9 + (allowDefault ? i - 1 : i) * 2 }}>A</span>}
          {l}
        </button>
      ))}
    </div>
  );
}
