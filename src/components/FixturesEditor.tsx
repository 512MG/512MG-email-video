import { useEffect, useState, type FormEvent } from "react";
import { fromLocalInput, supabase, toLocalInput, type Fixture, type Org } from "../lib/supabase";

type Draft = { kickoff: string; title: string; home_away: "" | "home" | "away" | "neutral"; competition: string; venue: string; ticket_url: string };
const empty: Draft = { kickoff: "", title: "", home_away: "", competition: "", venue: "", ticket_url: "" };

function normaliseUrl(u: string) {
  const s = u.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
    if (!d.kickoff || !d.title.trim()) { setErr("Add a date/time and an opponent or event name."); return; }
    setBusy(true);
    const row = {
      org_id: org.id,
      kickoff: fromLocalInput(d.kickoff),
      title: d.title.trim(),
      home_away: d.home_away || null,
      competition: d.competition.trim() || null,
      venue: d.venue.trim() || null,
      ticket_url: normaliseUrl(d.ticket_url) || null,
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
    setD({ kickoff: toLocalInput(f.kickoff), title: f.title, home_away: f.home_away ?? "", competition: f.competition ?? "", venue: f.venue ?? "", ticket_url: f.ticket_url ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (f: Fixture) => {
    if (!confirm(`Delete "${f.title}"?`)) return;
    await supabase.from("fixtures").delete().eq("id", f.id);
    if (editing === f.id) { setEditing(null); setD(empty); }
    load();
  };

  const cutoff = Date.now() - 2 * 3600 * 1000;
  const upcoming = rows.filter((f) => Date.parse(f.kickoff) >= cutoff);
  const past = rows.filter((f) => Date.parse(f.kickoff) < cutoff).reverse();

  return (
    <div className="max-w-4xl space-y-6">
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <h3 className="font-semibold">{editing ? "Edit fixture" : "Add a fixture"}</h3>
          <p className="text-xs text-zinc-500">One list for the whole organisation. Videos with "Show upcoming fixtures" ticked show the next few automatically, and past fixtures drop off by themselves.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr_150px]">
          <div><label className="label">Date & time</label><input type="datetime-local" className="input" value={d.kickoff} onChange={(e) => set("kickoff", e.target.value)} required /></div>
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
                <td className="whitespace-nowrap px-4 py-3 text-xs">{fmt(f.kickoff)}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{f.title}{f.home_away && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600">{f.home_away}</span>}</div>
                  <div className="text-xs text-zinc-500">{[f.competition, f.venue].filter(Boolean).join(" · ")}{f.ticket_url ? " · Tickets link" : ""}</div>
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
