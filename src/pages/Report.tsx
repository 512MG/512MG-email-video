import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fmtDuration } from "../lib/supabase";
import { BrandedPage, type Brand } from "../components/BrandedPage";

type ReportVideo = {
  title: string; duration: number | null; created_at: string;
  live_from: string | null; live_until: string | null; switched_off: boolean;
  plays: number; viewers: number; avg_seconds: number; total_seconds: number; completions: number;
  clicks: { label: string; clicks: number }[];
};
type ReportResponse = { state: "ok" | "not_found"; brand?: Brand; videos?: ReportVideo[]; generated_at?: string };

/** Public, read-only stats page for a client: /r/<token> */
export default function Report() {
  const { token = "" } = useParams();
  const [data, setData] = useState<ReportResponse | null>(null);

  useEffect(() => {
    api<ReportResponse>("report", { token }).then((d) => {
      setData(d);
      if (d.brand) document.title = `${d.brand.name} – video stats`;
    }).catch(() => setData({ state: "not_found" }));
  }, [token]);

  if (!data) return <div className="min-h-screen bg-zinc-50" />;
  if (data.state !== "ok" || !data.brand) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-center">
        <div><h1 className="text-2xl font-bold text-ink">Link not available</h1><p className="mt-2 text-zinc-500">This stats link has been switched off or isn't valid.</p></div>
      </div>
    );
  }

  const vids = data.videos ?? [];
  const totals = vids.reduce((a, v) => ({
    plays: a.plays + v.plays, viewers: a.viewers + v.viewers, minutes: a.minutes + v.total_seconds / 60,
    clicks: a.clicks + v.clicks.reduce((n, c) => n + c.clicks, 0),
  }), { plays: 0, viewers: 0, minutes: 0, clicks: 0 });
  const b = data.brand;
  const sq = b.corner_style === "square";
  const card = `${sq ? "" : "rounded-2xl"} p-4`;
  const tint = { background: `${b.text_color}10`, border: `1px solid ${b.text_color}22` };

  return (
    <BrandedPage brand={b}>
      <h1 className="text-3xl font-bold">Video stats</h1>
      <p className="mt-1 text-sm opacity-60">Updated {new Date(data.generated_at!).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Plays" value={totals.plays.toLocaleString("en-GB")} cls={card} style={tint} />
        <Tile label="Unique viewers" value={totals.viewers.toLocaleString("en-GB")} cls={card} style={tint} />
        <Tile label="Minutes watched" value={Math.round(totals.minutes).toLocaleString("en-GB")} cls={card} style={tint} />
        <Tile label="Link clicks" value={totals.clicks.toLocaleString("en-GB")} cls={card} style={tint} />
      </div>

      <div className="mt-8 space-y-3 text-left">
        {vids.length === 0 && <p className="text-center opacity-70">No videos yet.</p>}
        {vids.map((v, i) => {
          const pct = v.duration ? Math.min(100, Math.round((v.avg_seconds / v.duration) * 100)) : null;
          return (
            <div key={i} className={card} style={tint}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{v.title}</h2>
                <span className="text-xs opacity-60">Added {new Date(v.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Mini label="Plays" value={v.plays} />
                <Mini label="Unique viewers" value={v.viewers} />
                <Mini label="Avg watched" value={`${fmtDuration(v.avg_seconds)}${pct !== null ? ` (${pct}%)` : ""}`} />
                <Mini label="Watched to the end" value={v.completions} />
              </div>
              {v.clicks.length > 0 && (
                <div className="mt-3 border-t pt-3 text-sm" style={{ borderColor: `${b.text_color}22` }}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Clicks</div>
                  {v.clicks.map((c, j) => (
                    <div key={j} className="flex justify-between py-0.5"><span className="truncate pr-3">{c.label}</span><span className="font-semibold">{c.clicks}</span></div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BrandedPage>
  );
}

function Tile({ label, value, cls, style }: { label: string; value: string; cls: string; style: React.CSSProperties }) {
  return <div className={cls} style={style}><div className="text-2xl font-bold">{value}</div><div className="text-xs opacity-60">{label}</div></div>;
}
function Mini({ label, value }: { label: string; value: string | number }) {
  return <div><div className="text-xs opacity-60">{label}</div><div className="font-semibold">{value}</div></div>;
}
