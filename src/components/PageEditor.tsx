import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtKickoff, joinKickoff, supabase, type Fixture, type Org, type Video } from "../lib/supabase";
import { BrandedPage, VideoPageContent, VideoPlaceholder, type PageButton } from "./BrandedPage";
import { SizePicker } from "./BrandEditor";

const MAX_BUTTONS = 6;

type Draft = {
  title: string; headline: string; message: string; body: string; buttons: PageButton[];
  show_fixtures: boolean; fixtures_title: string; show_sponsors: boolean; countdown: "none" | "expiry" | "fixture";
  corner_style: "" | "rounded" | "square";
  fixture_size: "" | "small" | "medium" | "large" | "xl";
};

const fromVideo = (v: Video): Draft => ({
  title: v.title,
  headline: v.headline ?? "",
  message: v.message ?? "",
  body: v.body ?? "",
  buttons: (v.buttons ?? []).map((b) => ({ label: b.label ?? "", url: b.url ?? "", style: b.style === "secondary" ? "secondary" : "primary", color: b.color ?? null })),
  show_fixtures: !!v.show_fixtures,
  fixtures_title: v.fixtures_title ?? "",
  show_sponsors: !!v.show_sponsors,
  countdown: v.countdown ?? "none",
  corner_style: v.corner_style ?? "",
  fixture_size: v.fixture_size ?? "",
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

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const loadFixtures = () => {
    const cutoff = Date.now() - 2 * 3600 * 1000;
    return supabase.from("fixtures").select("*").eq("org_id", org.id)
      .gte("kickoff", new Date(cutoff - 24 * 3600 * 1000).toISOString())
      .order("kickoff", { ascending: true }).limit(12)
      .then(({ data }) => setFixtures(((data as Fixture[]) ?? [])
        .filter((f) => Date.parse(f.kickoff) + (f.time_tbc ? 24 * 3600 * 1000 : 0) >= cutoff).slice(0, 6)));
  };
  useEffect(() => {
    loadFixtures();
    // Pick up fixtures added in another tab/window
    const onFocus = () => loadFixtures();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [org.id]);
  const sponsorCount = (org.sponsors ?? []).filter((s) => s.logo_url).length;

  const original = JSON.stringify(fromVideo(video));
  const dirty = JSON.stringify(d) !== original;

  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => { setD((p) => ({ ...p, [k]: val })); setErr(""); };
  const setBtn = (i: number, patch: Partial<PageButton>) => set("buttons", d.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const addBtn = () => set("buttons", [...d.buttons, { label: "", url: "", style: d.buttons.length === 0 ? "primary" : "secondary", color: null }]);
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
      .map((b) => ({ label: b.label.trim(), url: normaliseUrl(b.url), style: b.style, color: b.color || null }));
    const ok = await onSave({
      title: d.title.trim() || video.title,
      headline: d.headline.trim() || null,
      message: d.message.trim() || null,
      body: d.body.trim() || null,
      buttons,
      show_fixtures: d.show_fixtures,
      fixtures_title: d.fixtures_title.trim() || null,
      show_sponsors: d.show_sponsors,
      countdown: d.countdown,
      corner_style: d.corner_style || null,
      fixture_size: d.fixture_size || null,
    });
    setSaving(false);
    if (ok) { setD({ ...d, buttons }); setSavedAt(Date.now()); }
  };

  const brand = { name: org.name, logo_url: org.logo_url, bg_color: org.bg_color, text_color: org.text_color, accent_color: org.accent_color, font: org.font, corner_style: org.corner_style,
    fixture_badge_color: org.fixture_badge_color, ticket_button_color: org.ticket_button_color, card_color: org.card_color,
    fixture_size: d.fixture_size || org.fixture_size || "medium" };
  brand.corner_style = d.corner_style || org.corner_style;
  const previewContent = {
    ...d,
    fixtures: d.show_fixtures ? fixtures : [],
    sponsors: d.show_sponsors ? org.sponsors : [],
    sponsors_title: org.sponsors_title,
    live_until: video.switched_off ? null : video.live_until,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div>
          <label className="label">Video name <span className="normal-case text-zinc-400">(dashboard only)</span></label>
          <input className="input" value={d.title} onChange={(e) => set("title", e.target.value)} />
        </div>

        <Group title="Video">
          <div>
            <label className="label">Video & button corners</label>
            <div className="grid max-w-md grid-cols-3 gap-2">
              {([["", `Brand default (${org.corner_style === "square" ? "square" : "rounded"})`], ["rounded", "Rounded"], ["square", "Square"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => set("corner_style", k)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs font-semibold ${d.corner_style === k ? "border-ink bg-zinc-50 text-ink" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}>
                  <span className={`h-6 w-10 border-2 border-current ${(k || org.corner_style) === "square" ? "" : "rounded-md"}`} />
                  <span className="text-center leading-tight">{l}</span>
                </button>
              ))}
            </div>
          </div>
        </Group>

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
                    <div className="flex items-center gap-1.5 rounded-md bg-white px-1.5 py-0.5 ring-1 ring-zinc-200">
                      <input type="color" value={b.color || (b.style === "primary" ? org.accent_color : org.text_color)}
                        onChange={(e) => setBtn(i, { color: e.target.value })} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" title="Button colour" />
                      {b.color
                        ? <button type="button" className="font-semibold text-zinc-500 hover:text-ink" onClick={() => setBtn(i, { color: null })}>Reset</button>
                        : <span className="text-zinc-400">Brand colour</span>}
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

        <Group title="Extras">
          <Toggle checked={d.show_fixtures} onChange={(v) => set("show_fixtures", v)} label="Show upcoming fixtures"
            hint="Shows the next fixtures from this organisation's fixture list. Past ones drop off automatically." />
          {d.show_fixtures && (
            <div className="space-y-3 pl-11">
              <input className="input max-w-xs" value={d.fixtures_title} onChange={(e) => set("fixtures_title", e.target.value)} placeholder="Heading: Upcoming fixtures" />
              <div>
                <label className="label">Fixture text size</label>
                <SizePicker value={d.fixture_size} onChange={(v) => set("fixture_size", v)} allowDefault
                  defaultLabel={`Brand default (${(org.fixture_size ?? "medium") === "xl" ? "extra large" : org.fixture_size ?? "medium"})`} />
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wide text-zinc-500">Fixture list ({fixtures.length} upcoming)</span>
                  <Link to={`/o/${org.id}?tab=fixtures`} className="font-semibold text-zinc-600 underline hover:text-ink">Manage all fixtures</Link>
                </div>
                {fixtures.length > 0 && (
                  <ul className="mb-3 space-y-1 text-sm">
                    {fixtures.map((f) => (
                      <li key={f.id} className="flex justify-between gap-3">
                        <span className="truncate font-medium">{f.title}</span>
                        <span className="shrink-0 text-xs text-zinc-500">{fmtKickoff(f.kickoff, f.time_tbc)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <QuickFixture orgId={org.id} onAdded={loadFixtures} first={fixtures.length === 0} />
              </div>
            </div>
          )}
          <Toggle checked={d.show_sponsors} onChange={(v) => set("show_sponsors", v)} label="Show sponsors"
            hint={sponsorCount ? `${sponsorCount} sponsor logo${sponsorCount === 1 ? "" : "s"} from the Sponsors tab.` : "Shows the sponsor logos from the Sponsors tab."} />
          {d.show_sponsors && sponsorCount === 0 && (
            <p className="pl-11 text-xs text-amber-700">
              No sponsors added yet. <Link to={`/o/${org.id}?tab=sponsors`} className="font-semibold underline">Add sponsors</Link>, then come back. They'll appear straight away.
            </p>
          )}
          <div>
            <label className="label">Countdown</label>
            <select className="input max-w-sm" value={d.countdown} onChange={(e) => set("countdown", e.target.value as Draft["countdown"])}>
              <option value="none">No countdown</option>
              <option value="expiry">Until this video expires</option>
              <option value="fixture">Until the next fixture</option>
            </select>
            {d.countdown === "expiry" && !video.live_until && <p className="mt-1 text-xs text-amber-700">Set an expiry time under "When it's live" for this to show.</p>}
            {d.countdown === "fixture" && !fixtures.length && <p className="mt-1 text-xs text-amber-700">Add an upcoming fixture (and tick "Show upcoming fixtures") for this to show.</p>}
            {d.countdown === "fixture" && fixtures.length > 0 && !d.show_fixtures && <p className="mt-1 text-xs text-amber-700">Tick "Show upcoming fixtures" for this to show.</p>}
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
            <VideoPageContent compact brand={brand} content={previewContent} video={<VideoPlaceholder />} />
            {d.show_fixtures && fixtures.length === 0 && <PreviewHint text="Your upcoming fixtures will show here. Add one on the left." />}
            {d.show_sponsors && sponsorCount === 0 && <PreviewHint text="Sponsor logos will show here once added on the Sponsors tab." />}
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

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 h-5 w-8 shrink-0 rounded-full p-0.5 transition ${checked ? "bg-ink" : "bg-zinc-300"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-3" : ""}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </button>
  );
}

function PreviewHint({ text }: { text: string }) {
  return <div className="mt-4 rounded-lg border-2 border-dashed border-current p-3 text-xs opacity-50">{text}</div>;
}

/** Add a fixture without leaving the video page. */
function QuickFixture({ orgId, onAdded, first }: { orgId: string; onAdded: () => void; first: boolean }) {
  const [open, setOpen] = useState(first);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [ha, setHa] = useState("");
  const [tickets, setTickets] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    setErr("");
    if (!date || !title.trim()) { setErr("Add a date and an opponent or event name."); return; }
    setBusy(true);
    const t = tickets.trim();
    const { error } = await supabase.from("fixtures").insert({
      org_id: orgId, kickoff: joinKickoff(date, time), time_tbc: !time, title: title.trim(), home_away: ha || null,
      ticket_url: t ? (/^https?:\/\//i.test(t) ? t : `https://${t}`) : null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDate(""); setTime(""); setTitle(""); setHa(""); setTickets("");
    onAdded();
  };

  if (!open) return <button type="button" className="text-sm font-semibold text-ink underline" onClick={() => setOpen(true)}>+ Add a fixture</button>;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[150px_120px_1fr]">
        <div><label className="label">Date</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label">Kick-off</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div><label className="label">Opponent / event</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. vs Leeds Rhinos" /></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
        <select className="input" value={ha} onChange={(e) => setHa(e.target.value)}>
          <option value="">Home/away</option><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option>
        </select>
        <input className="input" value={tickets} onChange={(e) => setTickets(e.target.value)} placeholder="Ticket link (optional)" />
      </div>
      <p className="text-xs text-zinc-400">Leave kick-off blank if it's not confirmed yet. It'll show as "KO TBC".</p>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={add}>{busy ? "Adding…" : "Add fixture"}</button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
      <p className="text-xs text-zinc-500">Fixtures are shared across all of this organisation's videos. Competition and venue can be added under "Manage all fixtures".</p>
    </div>
  );
}
