import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Org = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  bg_color: string;
  text_color: string;
  accent_color: string;
  font: string;
  headline: string | null;
  message: string | null;
  button_text: string | null;
  button_url: string | null;
  not_live_title: string;
  not_live_message: string;
  expired_title: string;
  expired_message: string;
  corner_style: "rounded" | "square";
  fixture_badge_color: string | null;
  ticket_button_color: string | null;
  card_color: string | null;
  privacy_url: string | null;
  fixture_size: FixtureSize;
  sponsors: Sponsor[];
  sponsors_title: string;
  report_token: string | null;
  created_at: string;
};

export type FixtureSize = "small" | "medium" | "large" | "xl";
export const FIXTURE_SIZES: [FixtureSize, string][] = [["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["xl", "Extra large"]];

export type Sponsor = { name: string; logo_url: string; url: string };

export type Fixture = {
  id: string;
  org_id: string;
  kickoff: string;
  time_tbc: boolean;
  title: string;
  home_away: "home" | "away" | "neutral" | null;
  competition: string | null;
  venue: string | null;
  ticket_url: string | null;
  image_url: string | null;
};

export type Video = {
  id: string;
  org_id: string;
  title: string;
  slug: string;
  stream_uid: string | null;
  status: "uploading" | "processing" | "ready" | "error";
  duration: number | null;
  playback_host: string | null;
  poster_url: string | null;
  email_image_url: string | null;
  headline: string | null;
  message: string | null;
  button_text: string | null;
  button_url: string | null;
  body: string | null;
  buttons: { label: string; url: string; style: "primary" | "secondary"; color?: string | null }[];
  live_from: string | null;
  live_until: string | null;
  switched_off: boolean;
  show_fixtures: boolean;
  fixtures_title: string | null;
  show_sponsors: boolean;
  countdown: "none" | "expiry" | "fixture";
  captions: boolean;
  captions_status: "generating" | "ready" | "error" | null;
  pending_uid: string | null;
  corner_style: "rounded" | "square" | null;
  fixture_size: FixtureSize | null;
  fixtures_title_size: FixtureSize;
  feature_image_url: string | null;
  feature_image_link: string | null;
  created_at: string;
};

export type Stat = {
  video_id: string;
  plays: number;
  viewers: number;
  total_seconds: number;
  avg_seconds: number;
  completions: number;
  last_view: string | null;
  clicks: number;
};

export type Membership = { org_id: string; user_id: string; email: string | null; role: "owner" | "member"; created_at: string };

export async function api<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ action, ...body }),
  });
  if ((action === "thumbnail" || action === "backup_download") && res.ok) return (await res.blob()) as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** Fire-and-forget event that survives the page navigating away (used for click tracking). */
export function beacon(action: string, body: Record<string, unknown>) {
  const payload = JSON.stringify({ action, ...body });
  const url = `${SUPABASE_URL}/functions/v1/api`;
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([payload], { type: "text/plain" }))) return;
  } catch { /* fall through */ }
  fetch(url, { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

/** Turns rows into a CSV file download. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function randomToken(len = 32) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => chars[b % chars.length]).join("");
}

/** Supabase image addresses → the site's cached /img/ address (served via Cloudflare, saves Supabase bandwidth). */
const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/`;
export const cdnImg = <T extends string | null | undefined>(u: T): T => {
  if (!u || !u.startsWith(STORAGE_PUBLIC)) return u;
  const rest = u.slice(STORAGE_PUBLIC.length).split("?")[0];
  if (!/^(brand|email-images)\//.test(rest)) return u;
  return `${window.location.origin}/img/${rest}` as T;
};

export const watchUrl = (orgSlug: string, videoSlug: string) => `${window.location.origin}/v/${orgSlug}/${videoSlug}`;

export function liveState(v: Video): { label: string; tone: "green" | "amber" | "zinc" | "red" } {
  const now = Date.now();
  if (v.pending_uid) return { label: "Replacing video", tone: "amber" };
  if (v.status === "error") return { label: "Upload failed", tone: "red" };
  if (v.status !== "ready") return { label: "Processing", tone: "amber" };
  if (v.switched_off) return { label: "Switched off", tone: "red" };
  if (v.live_until && now >= Date.parse(v.live_until)) return { label: "Expired", tone: "zinc" };
  if (v.live_from && now < Date.parse(v.live_from)) return { label: "Scheduled", tone: "amber" };
  return { label: "Live", tone: "green" };
}

export const fmtDuration = (s: number | null | undefined) => {
  if (!s || s <= 0) return "–";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–";

// <input type="datetime-local"> helpers (browser local time ⇄ ISO)
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** Separate date + kick-off time inputs ⇄ stored timestamp. Blank time = TBC. */
export const joinKickoff = (date: string, time: string) => new Date(`${date}T${time || "00:00"}`).toISOString();
export const splitKickoff = (iso: string, tbc: boolean) => {
  const local = toLocalInput(iso);
  return { date: local.slice(0, 10), time: tbc ? "" : local.slice(11, 16) };
};
export const fmtKickoff = (iso: string, tbc: boolean) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
  (tbc ? " · KO TBC" : ` · KO ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export const FONTS = ["Inter", "Poppins", "Montserrat", "Lato", "Playfair Display", "Oswald", "Nunito", "Roboto Slab", "Bebas Neue"];

export function loadFont(font: string) {
  const id = `font-${font.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

/**
 * Shrinks an image in the browser (longest side max 1080px, JPEG ~82%) and uploads it
 * to the organisation's folder in the public "brand" bucket. Returns the public URL.
 */
export async function uploadImage(file: File, orgId: string, prefix: string, maxSide = 1080): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That isn't an image. Use JPG, PNG or WebP.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Image is over 20 MB. Export a smaller version.");
  let blob: Blob = file;
  let ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  if (file.type !== "image/gif" && file.type !== "image/svg+xml") {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // flatten transparency for JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(img.src);
    const out: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (out) { blob = out; ext = "jpg"; }
  }
  const path = `${orgId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("brand").upload(path, blob, { contentType: blob.type || file.type, cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from("brand").getPublicUrl(path).data.publicUrl;
}
