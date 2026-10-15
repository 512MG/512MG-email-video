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
  created_at: string;
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
  buttons: { label: string; url: string; style: "primary" | "secondary" }[];
  live_from: string | null;
  live_until: string | null;
  switched_off: boolean;
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
  if (action === "thumbnail" && res.ok) return (await res.blob()) as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const watchUrl = (orgSlug: string, videoSlug: string) => `${window.location.origin}/v/${orgSlug}/${videoSlug}`;

export function liveState(v: Video): { label: string; tone: "green" | "amber" | "zinc" | "red" } {
  const now = Date.now();
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
