import { Fragment, useEffect, type ReactNode } from "react";
import { loadFont } from "../lib/supabase";

export type Brand = {
  name: string;
  logo_url: string | null;
  bg_color: string;
  text_color: string;
  accent_color: string;
  font: string;
};

export type PageButton = { label: string; url: string; style: "primary" | "secondary" };

export type PageContent = {
  headline: string;
  message: string;
  body: string;
  buttons: PageButton[];
};

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
 * Everything around the video: headline + message above, extra text and buttons below.
 * `video` is the player (or a placeholder in previews).
 */
export function VideoPageContent({ brand, content, video, compact = false }: { brand: Brand; content: PageContent; video: ReactNode; compact?: boolean }) {
  const buttons = content.buttons.filter((b) => b.label.trim() && b.url.trim());
  return (
    <>
      {content.headline.trim() && (
        <h1 className={`font-bold leading-tight ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>{content.headline}</h1>
      )}
      {content.message.trim() && (
        <div className={`mx-auto max-w-xl opacity-85 ${compact ? "mt-2 text-base" : "mt-3 text-lg"}`}><RichText text={content.message} accent={brand.accent_color} /></div>
      )}

      <div className={`overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 ${content.headline.trim() || content.message.trim() ? (compact ? "mt-4" : "mt-6") : ""}`}>
        {video}
      </div>

      {content.body.trim() && (
        <div className={`mx-auto max-w-2xl text-left opacity-90 ${compact ? "mt-5 text-sm" : "mt-8 text-base sm:text-lg"}`}>
          <RichText text={content.body} accent={brand.accent_color} />
        </div>
      )}

      {buttons.length > 0 && (
        <div className={`mx-auto flex w-full max-w-xl flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center ${compact ? "mt-5" : "mt-8"}`}>
          {buttons.map((b, i) => (
            <a
              key={i}
              href={b.url}
              target="_blank"
              rel="noopener"
              className={`rounded-full px-7 py-3 text-center text-base font-semibold transition hover:brightness-110 sm:min-w-[200px] ${b.style === "primary" ? "shadow-lg" : "border-2"}`}
              style={b.style === "primary"
                ? { background: brand.accent_color, color: readableOn(brand.accent_color) }
                : { borderColor: brand.text_color, color: brand.text_color }}
            >
              {b.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/** Plain text with paragraphs, line breaks and clickable links. */
export function RichText({ text, accent }: { text: string; accent: string }) {
  const paras = text.trim().split(/\n{2,}/);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className={i > 0 ? "mt-3" : ""}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {linkify(line, accent)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

function linkify(line: string, accent: string) {
  const parts = line.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2" style={{ color: accent }}>
        {part.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
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
