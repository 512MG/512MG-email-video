// Email Video API: one function, many actions.
// Public actions: setup_status, setup (first admin only), watch, progress.
// Signed-in actions: create_upload, refresh_video, thumbnail, delete_video,
//                    create_user, remove_member, reset_password.
// Secrets needed (Supabase → Edge Functions → Secrets): CF_ACCOUNT_ID, CF_STREAM_TOKEN.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CF_ACCOUNT = Deno.env.get("CF_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CF_STREAM_TOKEN") ?? "";

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

// ---------- Cloudflare Stream helpers ----------
function needStream() {
  if (!CF_ACCOUNT || !CF_TOKEN) {
    throw new HttpError("Video hosting isn't connected yet. Add CF_ACCOUNT_ID and CF_STREAM_TOKEN in Supabase → Edge Functions → Secrets.", 503);
  }
}

async function cf(path: string, init: RequestInit = {}) {
  needStream();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const msg = data?.errors?.[0]?.message ?? `Cloudflare error ${res.status}`;
    throw new HttpError(`Cloudflare Stream: ${msg}`, 502);
  }
  return data.result;
}

class HttpError extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (s: string) => b64url(new TextEncoder().encode(s));

let cachedKey: { id: string; key: CryptoKey } | null = null;

async function signingKey() {
  if (cachedKey) return cachedKey;
  let { data } = await admin.from("stream_keys").select("id, jwk").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) {
    const created = await cf("/keys", { method: "POST" });
    await admin.from("stream_keys").insert({ id: created.id, jwk: created.jwk });
    data = { id: created.id, jwk: created.jwk };
  }
  const jwk = JSON.parse(atob(data.jwk));
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  cachedKey = { id: data.id, key };
  return cachedKey;
}

async function playbackToken(uid: string, expSeconds: number) {
  try {
    const { id, key } = await signingKey();
    const header = b64urlStr(JSON.stringify({ alg: "RS256", kid: id }));
    const payload = b64urlStr(JSON.stringify({ sub: uid, kid: id, exp: expSeconds, nbf: Math.floor(Date.now() / 1000) - 60 }));
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`)));
    return `${header}.${payload}.${b64url(sig)}`;
  } catch (e) {
    if (e instanceof HttpError && e.status === 503) throw e;
    // Fallback: ask Cloudflare for a token (fine at low volume)
    const r = await cf(`/${uid}/token`, { method: "POST", body: JSON.stringify({ exp: expSeconds }) });
    return r.token as string;
  }
}

// ---------- auth helpers ----------
async function currentUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError("Please sign in.", 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError("Please sign in.", 401);
  return data.user;
}

async function isAgencyAdmin(userId: string) {
  const { data } = await admin.from("agency_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

async function requireMember(userId: string, orgId: string) {
  if (await isAgencyAdmin(userId)) return;
  const { data } = await admin.from("memberships").select("org_id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  if (!data) throw new HttpError("You don't have access to that organisation.", 403);
}

async function videoForUser(userId: string, videoId: string) {
  const { data: v } = await admin.from("videos").select("*").eq("id", videoId).maybeSingle();
  if (!v) throw new HttpError("Video not found.", 404);
  await requireMember(userId, v.org_id);
  return v;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function findUserByEmail(email: string) {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new HttpError(error.message, 500);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function syncFromStream(v: Record<string, any>) {
  if (!v.stream_uid) return v;
  const s = await cf(`/${v.stream_uid}`);
  const patch: Record<string, unknown> = {};
  if (s.readyToStream) patch.status = "ready";
  else if (s.status?.state === "error") patch.status = "error";
  else if (s.status?.state && s.status.state !== "pendingupload") patch.status = "processing";
  if (s.duration && s.duration > 0) patch.duration = s.duration;
  const hls: string | undefined = s.playback?.hls;
  if (hls) patch.playback_host = new URL(hls).host;
  if (Object.keys(patch).length) {
    const { data } = await admin.from("videos").update(patch).eq("id", v.id).select("*").single();
    return data ?? v;
  }
  return v;
}

// ---------- actions ----------
type Handler = (req: Request, body: any) => Promise<Response>;

const actions: Record<string, Handler> = {
  async setup_status() {
    const { count } = await admin.from("agency_admins").select("user_id", { count: "exact", head: true });
    return json({ needsSetup: (count ?? 0) === 0, streamConnected: !!(CF_ACCOUNT && CF_TOKEN) });
  },

  // Confirms the Cloudflare details work (no secrets returned)
  async stream_check() {
    if (!CF_ACCOUNT || !CF_TOKEN) {
      return json({ ok: false, accountIdSet: !!CF_ACCOUNT, tokenSet: !!CF_TOKEN, error: "Secrets missing" });
    }
    try {
      const vids = await cf("");
      return json({ ok: true, videos: Array.isArray(vids) ? vids.length : null });
    } catch (e) {
      return json({ ok: false, accountIdSet: true, tokenSet: true, error: (e as Error).message });
    }
  },

  async setup(_req, body) {
    const { count } = await admin.from("agency_admins").select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return fail("Setup has already been done.", 403);
    const { data: code } = await admin.from("app_settings").select("value").eq("key", "setup_code").maybeSingle();
    if (!code || String(body.code ?? "").trim().toUpperCase() !== code.value) return fail("That setup code isn't right.", 403);
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!email.includes("@") || password.length < 8) return fail("Enter an email and a password of at least 8 characters.");
    let user = await findUserByEmail(email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return fail(error.message);
      user = data.user;
    } else {
      await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    }
    await admin.from("agency_admins").insert({ user_id: user!.id });
    await admin.from("app_settings").delete().eq("key", "setup_code");
    return json({ ok: true });
  },

  async create_user(req, body) {
    const me = await currentUser(req);
    if (!(await isAgencyAdmin(me.id))) return fail("Only agency admins can add people.", 403);
    const email = String(body.email ?? "").trim().toLowerCase();
    const orgId = body.org_id ? String(body.org_id) : null;
    const role = body.role === "owner" ? "owner" : "member";
    const makeAdmin = body.agency_admin === true;
    if (!email.includes("@")) return fail("Enter a valid email.");
    let user = await findUserByEmail(email);
    let password: string | null = null;
    if (!user) {
      password = randomPassword();
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return fail(error.message);
      user = data.user;
    }
    if (orgId) {
      const { error } = await admin.from("memberships").upsert({ org_id: orgId, user_id: user!.id, email, role });
      if (error) return fail(error.message);
    }
    if (makeAdmin) await admin.from("agency_admins").upsert({ user_id: user!.id });
    return json({ ok: true, user_id: user!.id, email, password, existing: password === null });
  },

  async remove_member(req, body) {
    const me = await currentUser(req);
    if (!(await isAgencyAdmin(me.id))) return fail("Only agency admins can remove people.", 403);
    await admin.from("memberships").delete().eq("org_id", body.org_id).eq("user_id", body.user_id);
    return json({ ok: true });
  },

  async reset_password(req, body) {
    const me = await currentUser(req);
    if (!(await isAgencyAdmin(me.id))) return fail("Only agency admins can reset passwords.", 403);
    const password = randomPassword();
    const { error } = await admin.auth.admin.updateUserById(String(body.user_id), { password });
    if (error) return fail(error.message);
    return json({ ok: true, password });
  },

  async create_upload(req, body) {
    const me = await currentUser(req);
    const orgId = String(body.org_id ?? "");
    const title = String(body.title ?? "").trim() || "Untitled video";
    await requireMember(me.id, orgId);
    const r = await cf("/direct_upload", {
      method: "POST",
      body: JSON.stringify({ maxDurationSeconds: 3600, requireSignedURLs: true, meta: { name: title, org: orgId } }),
    });
    const { data, error } = await admin.from("videos")
      .insert({ org_id: orgId, title, stream_uid: r.uid, status: "uploading", created_by: me.id })
      .select("*").single();
    if (error) return fail(error.message, 500);
    return json({ uploadURL: r.uploadURL, video: data });
  },

  async refresh_video(req, body) {
    const me = await currentUser(req);
    const v = await videoForUser(me.id, String(body.video_id));
    return json({ video: await syncFromStream(v) });
  },

  async thumbnail(req, body) {
    const me = await currentUser(req);
    let v = await videoForUser(me.id, String(body.video_id));
    if (!v.playback_host) v = await syncFromStream(v);
    if (!v.playback_host) return fail("The video is still processing.", 409);
    const t = Math.max(0, Number(body.time ?? 1));
    const token = await playbackToken(v.stream_uid, Math.floor(Date.now() / 1000) + 600);
    const res = await fetch(`https://${v.playback_host}/${token}/thumbnails/thumbnail.jpg?time=${t}s&height=720`);
    if (!res.ok) return fail("Couldn't fetch a frame from the video.", 502);
    return new Response(res.body, { headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  },

  async delete_video(req, body) {
    const me = await currentUser(req);
    const v = await videoForUser(me.id, String(body.video_id));
    if (v.stream_uid && CF_ACCOUNT && CF_TOKEN) {
      try { await cf(`/${v.stream_uid}`, { method: "DELETE" }); } catch (_) { /* already gone */ }
    }
    await admin.from("videos").delete().eq("id", v.id);
    return json({ ok: true });
  },

  // ---------- public ----------
  async watch(req, body) {
    const orgSlug = String(body.org ?? "").toLowerCase();
    const slug = String(body.video ?? "").toLowerCase();
    const viewerId = String(body.viewer_id ?? "").slice(0, 64) || "anon";
    const { data: org } = await admin.from("organisations").select("*").eq("slug", orgSlug).maybeSingle();
    if (!org) return json({ state: "not_found" });
    // Preview (ignores the live window, not counted in stats) only for signed-in members of this org
    let preview = false;
    if (body.preview === true) {
      try {
        const me = await currentUser(req);
        await requireMember(me.id, org.id);
        preview = true;
      } catch { preview = false; }
    }
    const { data: v } = await admin.from("videos").select("*").eq("slug", slug).eq("org_id", org.id).maybeSingle();

    const brand = {
      name: org.name, logo_url: org.logo_url, bg_color: org.bg_color, text_color: org.text_color,
      accent_color: org.accent_color, font: org.font,
      not_live_title: org.not_live_title, not_live_message: org.not_live_message,
      expired_title: org.expired_title, expired_message: org.expired_message,
      button_text: org.button_text, button_url: org.button_url,
    };
    if (!v) return json({ state: "not_found", brand });

    const page = {
      title: v.title,
      headline: v.headline ?? org.headline ?? v.title,
      message: v.message ?? org.message ?? "",
      button_text: v.button_text ?? org.button_text,
      button_url: v.button_url ?? org.button_url,
      live_from: v.live_from,
    };
    const now = Date.now();
    let state = "live";
    if (v.switched_off) state = "expired";
    else if (v.live_until && now >= Date.parse(v.live_until)) state = "expired";
    else if (v.live_from && now < Date.parse(v.live_from)) state = "not_live";
    else if (v.status !== "ready") state = "processing";

    // Signed-in members can preview from the dashboard even outside the live window
    if (preview && state !== "processing" && state !== "live") {
      state = "live";
    }
    if (state !== "live") return json({ state, brand, page });

    let fresh = v;
    if (!fresh.playback_host) fresh = await syncFromStream(v);
    if (!fresh.playback_host) return json({ state: "processing", brand, page });

    const nowS = Math.floor(now / 1000);
    let exp = nowS + 4 * 3600;
    if (!preview && v.live_until) exp = Math.min(exp, Math.floor(Date.parse(v.live_until) / 1000) + 15 * 60);
    const token = await playbackToken(v.stream_uid, exp);
    const base = `https://${fresh.playback_host}/${token}`;

    let viewId: string | null = null;
    if (!preview) {
      viewId = crypto.randomUUID();
      await admin.from("views").insert({ id: viewId, video_id: v.id, viewer_id: viewerId, device: String(body.device ?? "").slice(0, 20) || null });
    }
    return json({
      state, brand, page, view_id: viewId,
      player: { iframe: `${base}/iframe`, poster: `${base}/thumbnails/thumbnail.jpg?time=1s&height=720`, duration: fresh.duration },
    });
  },

  async progress(_req, body) {
    const id = String(body.view_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("bad view");
    const { data: row } = await admin.from("views").select("*").eq("id", id).maybeSingle();
    if (!row) return fail("bad view", 404);
    if (Date.now() - Date.parse(row.started_at) > 6 * 3600 * 1000) return json({ ok: true });
    const delta = Math.min(Math.max(Number(body.watched_delta ?? 0), 0), 30);
    const pos = Math.max(Number(body.position ?? 0), 0);
    await admin.from("views").update({
      seconds_watched: Number(row.seconds_watched) + delta,
      max_position: Math.max(Number(row.max_position), pos),
      completed: row.completed || body.ended === true,
      last_seen_at: new Date().toISOString(),
    }).eq("id", id);
    return json({ ok: true });
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Use POST", 405);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const fn = actions[String(body.action ?? "")];
  if (!fn) return fail("Unknown action", 404);
  try {
    return await fn(req, body);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status);
    console.error(e);
    return fail("Something went wrong.", 500);
  }
});
