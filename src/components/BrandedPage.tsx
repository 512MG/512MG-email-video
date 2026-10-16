import { Fragment, useEffect, useState, type ReactNode } from "react";
import { cdnImg, loadFont } from "../lib/supabase";

export type Brand = {
  name: string;
  logo_url: string | null;
  bg_color: string;
  text_color: string;
  accent_color: string;
  font: string;
  corner_style?: "rounded" | "square";
  fixture_badge_color?: string | null;
  ticket_button_color?: string | null;
  card_color?: string | null;
  fixture_size?: "small" | "medium" | "large" | "xl";
  privacy_url?: string | null;
};

export type PageButton = { label: string; url: string; style: "primary" | "secondary"; color?: string | null };

export type PageFixture = {
  id: string;
  kickoff: string;
  time_tbc?: boolean;
  title: string;
  home_away: "home" | "away" | "neutral" | null;
  competition: string | null;
  venue: string | null;
  ticket_url: string | null;
  image_url?: string | null;
};

export type PageSponsor = { name: string; logo_url: string | null; url: string | null };

export type PageContent = {
  headline: string;
  message: string;
  body: string;
  buttons: PageButton[];
  fixtures?: PageFixture[];
  fixtures_title?: string;
  fixtures_title_size?: "small" | "medium" | "large" | "xl";
  feature_image_url?: string | null;
  feature_image_link?: string | null;
  sponsors?: PageSponsor[];
  sponsors_title?: string;
  countdown?: "none" | "expiry" | "fixture";
  live_until?: string | null;
};

export type TrackFn = (kind: "button" | "fixture" | "sponsor" | "link", label: string, url: string) => void;

/** A square-ish image (e.g. a 1080×1080 match poster): full width on phones, capped on desktop. */
function PageImage({ src, alt, link, brand, compact, onTrack, trackLabel }: {
  src: string; alt: string; link?: string | null; brand: Brand; compact: boolean; onTrack?: TrackFn; trackLabel: string;
}) {
  const img = (
    <img src={cdnImg(src)} alt={alt} loading="lazy" decoding="async"
      className={`block h-auto w-full shadow-xl ring-1 ring-black/10 ${brand.corner_style === "square" ? "" : "rounded-2xl"}`} />
  );
  return (
    <div className={`mx-auto w-full ${compact ? "" : "max-w-[560px]"}`}>
      {link ? (
        <a href={link} target="_blank" rel="noopener" onClick={() => onTrack?.("link", trackLabel, link)} className="block transition hover:opacity-90">{img}</a>
      ) : img}
    </div>
  );
}

const HEADING_SIZES = {
  full: { small: "text-base", medium: "text-xl", large: "text-2xl sm:text-3xl", xl: "text-3xl sm:text-4xl" },
  compact: { small: "text-sm", medium: "text-base", large: "text-xl", xl: "text-2xl" },
} as const;

const square = (b: Brand) => b.corner_style === "square";
/** Background for fixture cards and countdown tiles. */
const cardBg = (b: Brand, alpha = "0d") => b.card_color || `${b.text_color}${alpha}`;
const cardText = (b: Brand) => (b.card_color ? readableOn(b.card_color) : undefined);

/** The client-branded shell used by the public watch page and the dashboard previews. */
export function BrandedPage({ brand, children, compact = false }: { brand: Brand; children: ReactNode; compact?: boolean }) {
  useEffect(() => loadFont(brand.font), [brand.font]);
  return (
    <div
      className={`flex w-full flex-col items-center ${compact ? "min-h-full px-4 pb-8 pt-5" : "min-h-screen px-4 pb-12 pt-6 sm:pt-10"}`}
      style={{ background: brand.bg_color, color: brand.text_color, fontFamily: brand.font === "Inter" ? "'Inter Variable', Inter, system-ui, sans-serif" : `'${brand.font}', system-ui, sans-serif` }}
    >
      <header className={`flex items-center justify-center ${compact ? "mb-4 h-10" : "mb-5 h-12 sm:mb-8 sm:h-14"}`}>
        {brand.logo_url ? (
          <img src={cdnImg(brand.logo_url)} alt={brand.name} className="h-full max-w-[220px] object-contain" />
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
  const nextKnown = fixtures.find((f) => !f.time_tbc);
  if (content.countdown === "fixture" && nextKnown) countdownTarget = { at: nextKnown.kickoff, label: `${nextKnown.title} kicks off in` };

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
                ? { background: b.color || brand.accent_color, color: readableOn(b.color || brand.accent_color) }
                : { borderColor: b.color || brand.text_color, color: b.color || brand.text_color }}
            >
              {b.label}
            </a>
          ))}
        </div>
      )}

      {content.feature_image_url && (
        <div className={gap}>
          <PageImage src={content.feature_image_url} alt={content.fixtures_title || content.headline || "Image"} link={content.feature_image_link}
            brand={brand} compact={compact} onTrack={onTrack} trackLabel="Image" />
        </div>
      )}

      {fixtures.length > 0 && (
        <section className={`mx-auto w-full max-w-2xl text-left ${gap}`}>
          <h2 className={`font-bold leading-tight ${compact ? "mb-3" : "mb-4"} ${HEADING_SIZES[compact ? "compact" : "full"][content.fixtures_title_size ?? "medium"]}`}>{content.fixtures_title || "Upcoming fixtures"}</h2>
          <div className={compact ? "space-y-2.5" : "space-y-4"}>
            {fixtures.map((f) => (
              <div key={f.id} className={compact ? "space-y-2" : "space-y-3"}>
                {f.image_url && (
                  <PageImage src={f.image_url} alt={f.title} link={f.ticket_url} brand={brand} compact={compact} onTrack={onTrack} trackLabel={`Poster: ${f.title}`} />
                )}
                <FixtureCard f={f} brand={brand} compact={compact} onTrack={onTrack} />
              </div>
            ))}
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
                  <img src={cdnImg(s.logo_url!)} alt={s.name} className="max-h-full max-w-full object-contain" />
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

/** Text/box sizes for fixture cards. Previews (compact) step down one size so they fit the phone frame. */
const FX_SIZES = {
  small:  { pad: "p-3 sm:p-3.5", gap: "gap-x-4", block: "w-14 py-1.5", day: "text-[10px]", date: "text-xl my-0.5", title: "text-sm", ko: "text-xs", icon: "h-3.5 w-3.5", meta: "text-xs", btn: "px-3 py-2 text-xs", ha: "text-[9px]" },
  medium: { pad: "p-4 sm:p-5", gap: "gap-x-5", block: "w-[72px] py-2.5", day: "text-[11px]", date: "text-3xl my-1", title: "text-lg", ko: "text-sm", icon: "h-4 w-4", meta: "text-sm", btn: "px-5 py-2.5 text-sm", ha: "text-[10px]" },
  large:  { pad: "p-5 sm:p-6", gap: "gap-x-6", block: "w-20 py-3", day: "text-xs", date: "text-4xl my-1", title: "text-xl", ko: "text-base", icon: "h-5 w-5", meta: "text-base", btn: "px-6 py-3 text-base", ha: "text-[11px]" },
  xl:     { pad: "p-6 sm:p-7", gap: "gap-x-7", block: "w-24 py-3.5", day: "text-sm", date: "text-5xl my-1.5", title: "text-2xl", ko: "text-lg", icon: "h-5 w-5", meta: "text-lg", btn: "px-7 py-3.5 text-lg", ha: "text-xs" },
} as const;
const STEP_DOWN = { small: "small", medium: "small", large: "medium", xl: "large" } as const;

function FixtureCard({ f, brand, compact, onTrack }: { f: PageFixture; brand: Brand; compact: boolean; onTrack?: TrackFn }) {
  const sq = square(brand);
  const size = brand.fixture_size ?? "medium";
  const z = FX_SIZES[compact ? STEP_DOWN[size] : size];
  const d = new Date(f.kickoff);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const ha = f.home_away === "home" ? "H" : f.home_away === "away" ? "A" : null;
  const meta = [f.competition, f.venue].filter(Boolean).join(" · ");
  const badge = brand.fixture_badge_color || brand.accent_color;
  const ticket = brand.ticket_button_color || brand.accent_color;
  const txt = cardText(brand);
  const time = f.time_tbc ? "TBC" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex flex-wrap items-center gap-y-3 border ${z.gap} ${z.pad} ${sq ? "" : "rounded-2xl"}`}
      style={{ borderColor: brand.card_color ? brand.card_color : `${brand.text_color}33`, background: cardBg(brand), color: txt }}>
      <div className={`flex shrink-0 flex-col items-center justify-center text-center ${sq ? "" : "rounded-xl"} ${z.block}`} style={{ background: badge, color: readableOn(badge) }}>
        <span className={`${z.day} font-semibold uppercase tracking-wide`}>{weekday}</span>
        <span className={`font-bold leading-none ${z.date}`}>{d.getDate()}</span>
        <span className={`${z.day} font-semibold uppercase tracking-wide`}>{d.toLocaleDateString("en-GB", { month: "short" })}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className={`flex items-center gap-2 font-bold ${z.title}`}>
          {ha && <span className={`shrink-0 rounded px-1.5 py-0.5 font-bold leading-none ${z.ha}`} style={{ border: "1px solid currentColor", opacity: 0.8 }}>{ha}</span>}
          <span className="break-words">{f.title}</span>
        </div>
        <div className={`flex items-center gap-1.5 ${z.ko}`}>
          <svg viewBox="0 0 24 24" className={`${z.icon} shrink-0 opacity-70`} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <span className="font-semibold">Kick-off {time}</span>
        </div>
        {meta && <div className={`opacity-70 ${z.meta}`}>{meta}</div>}
      </div>
      {f.ticket_url && (
        <a href={f.ticket_url} target="_blank" rel="noopener" onClick={() => onTrack?.("fixture", `Tickets: ${f.title}`, f.ticket_url!)}
          className={`w-full shrink-0 text-center font-semibold transition hover:brightness-110 ${z.btn} ${compact ? "" : "sm:w-auto"} ${sq ? "" : "rounded-full"}`}
          style={{ background: ticket, color: readableOn(ticket) }}>
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
          <div key={unit} className={`min-w-[64px] px-3 py-2 ${square(brand) ? "" : "rounded-xl"}`} style={{ background: cardBg(brand, "14"), color: cardText(brand) }}>
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

/** Short privacy line at the foot of the watch page, with a panel explaining what's recorded and an opt-out. */
export function PrivacyNote({ brand, optedOut, onOptOut }: { brand: Brand; optedOut: boolean; onOptOut: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="mt-12 text-center text-xs opacity-60">
        {optedOut ? "Your visits to this page aren't being counted." : "This page counts views anonymously to see how the video performs."}{" "}
        <button type="button" className="underline underline-offset-2 hover:opacity-100" onClick={() => setOpen(true)}>About your privacy</button>
      </p>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="About your privacy"
          onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 text-left text-sm leading-relaxed text-zinc-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900">About your privacy</h2>
            <p className="mt-3">This video page is provided by <strong>{brand.name}</strong> and run on their behalf by 512 Media Group.</p>
            <h3 className="mt-4 font-semibold text-zinc-900">What we record</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>A random ID saved in your browser, so the same person opening the page twice isn't counted twice</li>
              <li>Whether you're on a phone, tablet or computer</li>
              <li>How much of the video you watched</li>
              <li>Which buttons or links on this page you tap</li>
            </ul>
            <p className="mt-3">We don't record your name, email address or IP address, and there are no advertising or tracking cookies. The figures are only used to see how the video performed.</p>
            <h3 className="mt-4 font-semibold text-zinc-900">Other services</h3>
            <p className="mt-1">The video is streamed by Cloudflare and the page's lettering may load from Google Fonts. Like any website, they receive your device's IP address so they can deliver the content.</p>
            <h3 className="mt-4 font-semibold text-zinc-900">Your choice</h3>
            {optedOut ? (
              <p className="mt-1 font-medium text-zinc-900">Done. Your visits won't be counted on this device from now on.</p>
            ) : (
              <>
                <p className="mt-1">You can stop your visits being counted on this device. The video will still play as normal.</p>
                <button type="button" className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 font-semibold text-zinc-900 hover:bg-zinc-50" onClick={onOptOut}>
                  Don't count my visits
                </button>
              </>
            )}
            {brand.privacy_url && (
              <p className="mt-4">More detail is in <a className="font-semibold text-zinc-900 underline" href={brand.privacy_url} target="_blank" rel="noopener noreferrer">{brand.name}'s privacy policy</a>.</p>
            )}
            <button type="button" className="mt-6 w-full rounded-lg bg-zinc-900 py-2.5 font-semibold text-white" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
