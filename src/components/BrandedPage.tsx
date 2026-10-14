import { useEffect, type ReactNode } from "react";
import { loadFont } from "../lib/supabase";

export type Brand = {
  name: string;
  logo_url: string | null;
  bg_color: string;
  text_color: string;
  accent_color: string;
  font: string;
};

/** The client-branded shell used by the public watch page and the brand preview. */
export function BrandedPage({
  brand,
  children,
  button,
  compact = false,
}: {
  brand: Brand;
  children: ReactNode;
  button?: { text: string | null; url: string | null };
  compact?: boolean;
}) {
  useEffect(() => loadFont(brand.font), [brand.font]);
  const showButton = button?.text && button?.url;
  return (
    <div
      className={`flex w-full flex-col items-center ${compact ? "min-h-full px-4 py-6" : "min-h-screen px-4 py-8 sm:py-12"}`}
      style={{ background: brand.bg_color, color: brand.text_color, fontFamily: `'${brand.font}', system-ui, sans-serif` }}
    >
      <header className="mb-6 flex h-14 items-center justify-center sm:mb-8">
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.name} className="max-h-14 max-w-[220px] object-contain" />
        ) : (
          <span className="text-xl font-bold tracking-tight">{brand.name}</span>
        )}
      </header>
      <main className="w-full max-w-3xl text-center">{children}</main>
      {showButton && (
        <a
          href={button!.url!}
          target="_blank"
          rel="noopener"
          className="mt-8 inline-block rounded-full px-7 py-3 text-base font-semibold shadow-lg transition hover:brightness-110"
          style={{ background: brand.accent_color, color: readableOn(brand.accent_color) }}
        >
          {button!.text}
        </a>
      )}
    </div>
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
