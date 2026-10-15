import { Fragment, useEffect, useState, type ReactNode } from "react";
import { loadFont } from "../lib/supabase";

export type Brand = {
  name: string;
  logo_url: string | null;
  bg_color: string;
  text_color: string;
  accent_color: string;
  font: string;
  corner_style?: "rounded" | "square";
};

export type PageButton = { label: string; url: string; style: "primary" | "secondary" };

export type PageFixture = {
  id: string;
  kickoff: string;
  title: string;
  home_away: "home" | "away" | "neutral" | null;
  competition: string | null;
  venue: string | null;
  ticket_url: string | null;
};

export type PageSponsor = { name: string; logo_url: string | null; url: string | null };

export type PageContent = {
  headline: string;
  message: string;
  body: string;
  buttons: PageButton[];
  fixtures?: PageFixture[];
  fixtures_title?: string;
  sponsors?: PageSponsor[];
  sponsors_title?: string;
  countdown?: "none" | "expiry" | "fixture";
  live_until?: string | null;
};

export type TrackFn = (kind: "button" | "fixture" | "sponsor" | "link", label: string, url: string) => void;

const square = (b: Brand) => b.corner_style === "square";

/** The client-branded shell used by the public watch page and the dashboard previews. */
export function BrandedPage({ brand, children, compact = false }: { brand: Brand; children: ReactNode; compact?: boolean }) {
  useEffect(() => loadFont(brand.font), [brand.font]);
  return (
    <div
      className={`flex w-full flex-col items-center ${compact ? "min-h-full px-4 pb-8 pt-5" : "min-h-screen px-4 pb-12 pt-6 sm:pt-10"}`}
      style={{ background: brand.bg_color, color: brand.text_color, fontFamily: `'${brand.font}', system-ui, sans-serif` }}
    >
      <header className={`flex items-center justify-center ${compact ? "mb-4 h-10" : "mb-5 h-12 sm:mb-8 sm:h-14"}`}>
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.name} className="h-full max-w-[220px] object-contain" />
        ) : (
          <span className="text-xl font-bold tracking-tight">{brand.name}</span>
        )}
      </header>
      <main className="w-full max-w-3xl text-center">{children}</main>
    </div>
  );
}

/**
 * Everything around the video: headline + message above; countdown, extra text,
 * buttons, fixtures and sponsors below. `video` is the player (or a placeholder in previews).
 */
export function VideoPageContent({ brand, content, video, compact = false, onTrack }: {
  brand: Brand; content: PageContent; video: ReactNode; compact?: boolean; onTrack?: TrackFn;
}) {
  const sq = square(brand);
  const buttons = content.buttons.filter((b) => b.label.trim() && b.url.trim());
  const fixtures = content.fixtures ?? [];
  const sponsors = (content.sponsors ?? []).filter((s) => s.logo_url);
  const gap = compact ? "mt-5" : "mt-8";

  let countdownTarget: { at: string; label: string } | null = null;
  if (content.countdown === "expiry" && content.live_until) countdownTarget = { at: content.live_until, label: "This message disappears in" };
  if (content.countdown === "fixture" && fixtures[0]) countdownTarget = { at: fixtures[0].kickoff, label: `${fixtures[0].title} kicks off in` };

  return (
    <>
      {content.headline.trim() && (
        <h1 className={`font-bold leading-tight ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>{content.headline}</h1>
      )}
      {content.message.trim() && (
        <div className={`mx-auto max-w-xl opacity-85 ${compact ? "mt-2 text-base" : "mt-3 text-lg"}`}><RichText text={content.message} accent={brand.accent_color} onTrack={onTrack} /></div>
      )}

      <div className={`overflow-hidden shadow-2xl ring-1 ring-black/10 ${sq ? "rounded-none" : "rounded-2xl"} ${content.headline.trim() || content.message.trim() ? (compact ? "mt-4" : "mt-6") : ""}`}>
        {video}
      </div>

      {countdownTarget && <Countdown brand={brand} at={countdownTarget.at} label={countdownTarget.label} compact={compact} />}

      {content.body.trim() && (
        <div className={`mx-auto max-w-2xl text-left opacity-90 ${gap} ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
          <RichText text={content.body} accent={brand.accent_color} onTrack={onTrack} />
        </div>
      )}

      {buttons.length > 0 && (
        <div className={`mx-auto flex w-full max-w-xl flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center ${gap}`}>
          {buttons.map((b, i) => (
            <a
              key={i}
              href={b.url}
              target="_blank"
              rel="noopener"
              onClick={() => onTrack?.("button", b.label, b.url)}
              className={`${sq ? "rounded-none" : "rounded-full"} px-7 py-3 text-center text-base font-semibold transition hover:brightness-110 sm:min-w-[200px] ${b.style === "primary" ? "shadow-lg" : "border-2"}`}
              style={b.style === "primary"
                ? { background: brand.accent_color, color: readableOn(brand.accent_color) }
                : { borderColor: brand.text_color, color: brand.text_color }}
            >
              {b.label}
            </a>
          ))}
        </div>
      )}

      {fixtures.length > 0 && (
        <section className={`mx-auto w-full max-w-2xl text-left ${gap}`}>
          <h2 className={`mb-3 font-bold ${compact ? "text-base" : "text-xl"}`}>{content.fixtures_title || "Upcoming fixtures"}</h2>
          <div className="space-y-2">
            {fixtures.map((f) => <FixtureCard key={f.id} f={f} brand={brand} compact={compact} onTrack={onTrack} />)}
          </div>
        </section>
      )}

      {sponsors.length > 0 && (
        <section className={`mx-auto w-full max-w-2xl ${compact ? "mt-6" : "mt-10"}`}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">{content.sponsors_title || "Our partners"}</h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {sponsors.map((s, i) => {
              const img = (
                <span className={`flex h-16 w-32 items-center justify-center bg-white p-2 ${sq ? "" : "rounded-xl"} ${compact ? "h-12 w-24" : ""}`}>
                  <img src={s.logo_url!} alt={s.name} className="max-h-full max-w-full object-contain" />
                </span>
              );
              return s.url ? (
                <a key={i} href={s.url} target="_blank" rel="noopener sponsored" title={s.name} onClick={() => onTrack?.("sponsor", s.name || s.url!, s.url!)} className="transition hover:opacity-80">{img}</a>
              ) : <span key={i} title={s.name}>{img}</span>;
            })}
          </div>
        </section>
      )}
    </>
  );
}

function FixtureCard({ f, brand, compact, onTrack }: { f: PageFixture; brand: Brand; compact: boolean; onTrack?: TrackFn }) {
  const sq = square(brand);
  const d = new Date(f.kickoff);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const ha = f.home_away === "home" ? "H" : f.home_away === "away" ? "A" : null;
  const meta = [f.competition, f.venue].filter(Boolean).join(" · ");
  return (
    <div className={`flex items-center gap-3 border p-3 ${sq ? "" : "rounded-xl"}`} style={{ borderColor: `${brand.text_color}33`, background: `${brand.text_color}0d` }}>
      <div className={`flex shrink-0 flex-col items-center justify-center px-2 py-1 text-center ${sq ? "" : "rounded-lg"} ${compact ? "w-14" : "w-16"}`} style={{ background: brand.accent_color, color: readableOn(brand.accent_color) }}>
        <span className="text-[10px] font-semibold uppercase leading-tight">{day.split(" ")[0]}</span>
        <span className={`font-bold leading-tight ${compact ? "text-lg" : "text-xl"}`}>{d.getDate()}</span>
        <span className="text-[10px] font-semibold uppercase leading-tight">{d.toLocaleDateString("en-GB", { month: "short" })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-2 font-semibold ${compact ? "text-sm" : "text-base"}`}>
          {ha && <span className="rounded px-1.5 text-[10px] font-bold" style={{ border: `1px solid ${brand.text_color}66` }}>{ha}</span>}
          <span className="truncate">{f.title}</span>
        </div>
        <div className="truncate text-xs opacity-70">{time}{meta ? ` · ${meta}` : ""}</div>
      </div>
      {f.ticket_url && (
        <a href={f.ticket_url} target="_blank" rel="noopener" onClick={() => onTrack?.("fixture", `Tickets: ${f.title}`, f.ticket_url!)}
          className={`shrink-0 px-3 py-2 text-xs font-semibold transition hover:brightness-110 ${sq ? "" : "rounded-full"}`}
          style={{ background: brand.accent_color, color: readableOn(brand.accent_color) }}>
          Tickets
        </a>
      )}
    </div>
  );
}

function Countdown({ brand, at, label, compact }: { brand: Brand; at: string; label: string; compact: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Date.parse(at) - now;
  if (!(ms > 0)) return null;
  const s = Math.floor(ms / 1000);
  const parts: [number, string][] = [[Math.floor(s / 86400), "days"], [Math.floor((s % 86400) / 3600), "hrs"], [Math.floor((s % 3600) / 60), "mins"], [s % 60, "secs"]];
  const shown = parts[0][0] > 0 ? parts.slice(0, 3) : parts.slice(1);
  return (
    <div className={`mx-auto ${compact ? "mt-4" : "mt-6"}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-70">{label}</div>
      <div className="flex justify-center gap-2">
        {shown.map(([n, unit]) => (
          <div key={unit} className={`min-w-[64px] px-3 py-2 ${square(brand) ? "" : "rounded-xl"}`} style={{ background: `${brand.text_color}14` }}>
            <div className={`font-bold tabular-nums ${compact ? "text-xl" : "text-3xl"}`}>{String(n).padStart(2, "0")}</div>
            <div className="text-[10px] font-semibold uppercase opacity-60">{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Plain text with paragraphs, line breaks and clickable links. */
export function RichText({ text, accent, onTrack }: { text: string; accent: string; onTrack?: TrackFn }) {
  const paras = text.trim().split(/\n{2,}/);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className={i > 0 ? "mt-3" : ""}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {linkify(line, accent, onTrack)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

function linkify(line: string, accent: string, onTrack?: TrackFn) {
  const parts = line.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (!/^https?:\/\//.test(part)) return <Fragment key={i}>{part}</Fragment>;
    const label = part.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    return (
      <a key={i} href={part} target="_blank" rel="noopener" onClick={() => onTrack?.("link", label, part)}
        className="font-semibold underline underline-offset-2" style={{ color: accent }}>
        {label}
      </a>
    );
  });
}

/** Picks black or white text for a given background colour. */
export function readableOn(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111111" : "#ffffff";
}

export function StateMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {message && <p className="mt-4 text-lg opacity-80">{message}</p>}
    </div>
  );
}

/** Stand-in for the player in previews. */
export function VideoPlaceholder({ poster }: { poster?: string | null }) {
  return (
    <div className="relative flex aspect-video w-full items-center justify-center bg-black/40">
      {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
        <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 text-black" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
    </div>
  );
}
