import { useEffect, useState, type FormEvent } from "react";
import { fmtKickoff, joinKickoff, splitKickoff, supabase, type Fixture, type Org } from "../lib/supabase";
import { ImageSlot } from "./PageEditor";

type Draft = { date: string; time: string; title: string; home_away: "" | "home" | "away" | "neutral"; competition: string; venue: string; ticket_url: string; image_url: string };
const empty: Draft = { date: "", time: "", title: "", home_away: "", competition: "", venue: "", ticket_url: "", image_url: "" };

function normaliseUrl(u: string) {
  const s = u.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}


/** One shared fixtures list per organisation. Videos choose whether to show the next few. */
export default function FixturesEditor({ org }: { org: Org }) {
  const [rows, setRows] = useState<Fixture[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [d, setD] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("fixtures").select("*").eq("org_id", org.id).order("kickoff", { ascending: true });
    setRows((data as Fixture[]) ?? []);
  };
  useEffect(() => { load(); }, [org.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p, [k]: v })); setErr(""); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!d.date || !d.title.trim()) { setErr("Add a date and an opponent or event name."); return; }
    setBusy(true);
    const row = {
      org_id: org.id,
      kickoff: joinKickoff(d.date, d.time),
      time_tbc: !d.time,
      title: d.title.trim(),
      home_away: d.home_away || null,
      competition: d.competition.trim() || null,
      venue: d.venue.trim() || null,
      ticket_url: normaliseUrl(d.ticket_url) || null,
      image_url: d.image_url || null,
    };
    const { error } = editing
      ? await supabase.from("fixtures").update(row).eq("id", editing)
      : await supabase.from("fixtures").insert(row);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setD(empty); setEditing(null); load();
  };

  const edit = (f: Fixture) => {
    setEditing(f.id);
    setD({ ...splitKickoff(f.kickoff, f.time_tbc), title: f.title, home_away: f.home_away ?? "", competition: f.competition ?? "", venue: f.venue ?? "", ticket_url: f.ticket_url ?? "", image_url: f.image_url ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (f: Fixture) => {
    if (!confirm(`Delete "${f.title}"?`)) return;
    await supabase.from("fixtures").delete().eq("id", f.id);
    if (editing === f.id) { setEditing(null); setD(empty); }
    load();
  };

  const cutoff = Date.now() - 2 * 3600 * 1000; // TBC fixtures are stored at midnight, so treat them as the whole day
  const isUpcoming = (f: Fixture) => Date.parse(f.kickoff) + (f.time_tbc ? 24 * 3600 * 1000 : 0) >= cutoff;
  const upcoming = rows.filter(isUpcoming);
  const past = rows.filter((f) => !isUpcoming(f)).reverse();

  return (
    <div className="max-w-4xl space-y-6">
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <h3 className="font-semibold">{editing ? "Edit fixture" : "Add a fixture"}</h3>
          <p className="text-xs text-zinc-500">One list for the whole organisation. Videos with "Show upcoming fixtures" ticked show the next few automatically, and past fixtures drop off by themselves.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[160px_130px_1fr_140px]">
          <div><label className="label">Date</label><input type="date" className="input" value={d.date} onChange={(e) => set("date", e.target.value)} required /></div>
          <div><label className="label">Kick-off</label><input type="time" className="input" value={d.time} onChange={(e) => set("time", e.target.value)} /><p className="mt-1 text-xs text-zinc-400">Blank = TBC</p></div>
          <div><label className="label">Opponent / event</label><input className="input" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. vs Leeds Rhinos" required /></div>
          <div><label className="label">Home / away</label>
            <select className="input" value={d.home_away} onChange={(e) => set("home_away", e.target.value as Draft["home_away"])}>
              <option value="">–</option><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Competition</label><input className="input" value={d.competition} onChange={(e) => set("competition", e.target.value)} placeholder="Optional" /></div>
          <div><label className="label">Venue</label><input className="input" value={d.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Optional" /></div>
          <div><label className="label">Ticket link</label><input className="input" value={d.ticket_url} onChange={(e) => set("ticket_url", e.target.value)} onBlur={(e) => set("ticket_url", normaliseUrl(e.target.value))} placeholder="Optional, adds a Tickets button" /></div>
        </div>
        <div>
          <label className="label">Poster <span className="normal-case text-zinc-400">(optional)</span></label>
          <ImageSlot orgId={org.id} url={d.image_url} onChange={(u) => set("image_url", u)} prefix="fixture"
            hint="Shown above this fixture on any video that lists it. Square (1080 × 1080) works best. Tapping it opens the ticket link if there is one." />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add fixture"}</button>
          {editing && <button type="button" className="text-sm text-zinc-500 hover:text-ink" onClick={() => { setEditing(null); setD(empty); }}>Cancel</button>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </form>

      <FixtureTable title={`Upcoming (${upcoming.length})`} rows={upcoming} onEdit={edit} onDelete={remove} empty="No upcoming fixtures yet." />

      {past.length > 0 && (
        <div>
          <button className="text-sm font-semibold text-zinc-500 hover:text-ink" onClick={() => setShowPast(!showPast)}>
            {showPast ? "Hide" : "Show"} past fixtures ({past.length})
          </button>
          {showPast && <div className="mt-3"><FixtureTable title="Past" rows={past} onEdit={edit} onDelete={remove} empty="" muted /></div>}
        </div>
      )}
    </div>
  );
}

function FixtureTable({ title, rows, onEdit, onDelete, empty, muted }: {
  title: string; rows: Fixture[]; onEdit: (f: Fixture) => void; onDelete: (f: Fixture) => void; empty: string; muted?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
      {rows.length === 0 ? <p className="p-4 text-sm text-zinc-500">{empty}</p> : (
        <table className={`w-full text-sm ${muted ? "text-zinc-500" : ""}`}>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-zinc-100 first:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs">{fmtKickoff(f.kickoff, f.time_tbc)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                  {f.image_url && <img src={f.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
                  <div>
                  <div className="font-semibold">{f.title}{f.home_away && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600">{f.home_away}</span>}</div>
                  <div className="text-xs text-zinc-500">{[f.competition, f.venue].filter(Boolean).join(" · ")}{f.ticket_url ? " · Tickets link" : ""}</div>
                  </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button className="mr-3 text-xs font-semibold text-zinc-600 hover:text-ink" onClick={() => onEdit(f)}>Edit</button>
                  <button className="text-xs font-semibold text-red-600 hover:text-red-800" onClick={() => onDelete(f)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
