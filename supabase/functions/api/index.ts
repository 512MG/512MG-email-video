// Email Video API: one function, many actions.
// Public actions: setup_status, setup (first admin only), watch, progress, click, report, maintenance.
// Signed-in actions: create_upload, cancel_replace, captions, refresh_video, thumbnail, delete_video,
//                    create_workspace, delete_account,
//                    create_user, remove_member, reset_password, backup_status, backup_download.
// Secrets needed (Supabase → Edge Functions → Secrets): CF_ACCOUNT_ID, CF_STREAM_TOKEN.
import { createClient } from "npm:@supabase/supabase-js@2";

// Only our own site may call this from a browser. Add custom domains via the ALLOWED_ORIGINS secret (comma separated).
const ALLOWED_ORIGINS = new Set(
  ["https://512mg-email-video.barkery.workers.dev", "http://localhost:5173",
   ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean)],
);
function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.512mg-email-video\.barkery\.workers\.dev$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://512mg-email-video.barkery.workers.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CF_ACCOUNT = Deno.env.get("CF_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CF_STREAM_TOKEN") ?? "";

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

// Free-trial limits for self-serve sign-ups (keeps Cloudflare Stream costs capped)
const TRIAL = { videos: 3, maxSeconds: 180, playsPerMonth: 300 };

// ---------- Cloudflare Stream helpers ----------
function needStream() {
  if (!CF_ACCOUNT || !CF_TOKEN) {
    throw new HttpError("Video hosting isn't connected yet. Add CF_ACCOUNT_ID and CF_STREAM_TOKEN in Supabase → Edge Functions → Secrets.", 503);
  }
}

async function cf(path: string, init: RequestInit = {}) {
  needStream();
  let res: Response;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  } catch (e) {
    throw new HttpError(`Couldn't reach Cloudflare Stream: ${scrub((e as Error).message)}`, 502);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const msg = data?.errors?.[0]?.message ?? `Cloudflare error ${res.status}`;
    throw new HttpError(`Cloudflare Stream: ${msg}`, 502);
  }
  return data.result;
}

/** Never echo secrets back in error messages. */
function scrub(msg: string) {
  let out = String(msg ?? "");
  for (const secret of [CF_TOKEN, CF_ACCOUNT]) if (secret) out = out.split(secret).join("[hidden]");
  return out.replace(/Bearer\s+\S+/gi, "Bearer [hidden]").replace(/cf[a-z]{2}_[A-Za-z0-9_-]+/g, "[hidden]").slice(0, 300);
}

/** Accepts only web, email and phone links. */
const safeUrl = (u: unknown) => {
  const s = String(u ?? "").trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(s) ? s : null;
};

/** Accepts only #rrggbb colours. */
const hex = (c: unknown) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : null);

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
  // Two-step verification: if the user has set it up, the session must have completed it (AAL2)
  const verified = (data.user.factors ?? []).some((f: any) => f.status === "verified");
  if (verified) {
    let aal = "aal1";
    try { aal = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal ?? "aal1"; } catch { /* treat as aal1 */ }
    if (aal !== "aal2") throw new HttpError("Please complete two-step verification.", 401);
  }
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
  const bytes = crypto.getRandomValues(new Uint8Array(16));
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
  const patch: Record<string, unknown> = {};

  // A replacement upload is in progress: keep the old video playing until the new one is ready
  if (v.pending_uid) {
    const n = await cf(`/${v.pending_uid}`).catch(() => null);
    if (n?.readyToStream) {
      const oldUid = v.stream_uid;
      patch.stream_uid = v.pending_uid;
      patch.pending_uid = null;
      patch.status = "ready";
      if (n.duration > 0) patch.duration = n.duration;
      if (n.playback?.hls) patch.playback_host = new URL(n.playback.hls).host;
      if (v.captions) patch.captions_status = "generating";
      const { data } = await admin.from("videos").update(patch).eq("id", v.id).select("*").single();
      try { await cf(`/${oldUid}`, { method: "DELETE" }); } catch { /* already gone */ }
      if (v.captions) { try { await cf(`/${v.pending_uid}/captions/en/generate`, { method: "POST" }); } catch { /* retry later */ } }
      return data ?? v;
    }
    if (n?.status?.state === "error") {
      const { data } = await admin.from("videos").update({ pending_uid: null }).eq("id", v.id).select("*").single();
      return { ...(data ?? v), replace_failed: true };
    }
    return v;
  }

  const s = await cf(`/${v.stream_uid}`);
  if (s.readyToStream) patch.status = "ready";
  else if (s.status?.state === "error") patch.status = "error";
  else if (s.status?.state && s.status.state !== "pendingupload") patch.status = "processing";
  if (s.duration && s.duration > 0) patch.duration = s.duration;
  const hls: string | undefined = s.playback?.hls;
  if (hls) patch.playback_host = new URL(hls).host;

  if (v.captions && v.captions_status === "generating" && s.readyToStream) {
    try {
      const list = await cf(`/${v.stream_uid}/captions`);
      const en = Array.isArray(list) ? list.find((c: any) => c.language === "en") : null;
      if (!en) { await cf(`/${v.stream_uid}/captions/en/generate`, { method: "POST" }).catch(() => {}); }
      else if (en.status === "ready") patch.captions_status = "ready";
      else if (en.status === "error") patch.captions_status = "error";
    } catch { /* try again next refresh */ }
  }

  if (Object.keys(patch).length) {
    const { data } = await admin.from("videos").update(patch).eq("id", v.id).select("*").single();
    return data ?? v;
  }
  return v;
}

// ---------- backups ----------
const BACKUP_TABLES = ["organisations", "memberships", "agency_admins", "videos", "fixtures", "views", "clicks"];
const KEEP_BACKUPS = 8;

async function makeBackup() {
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(t).select("*").range(from, from + 999);
      if (error) throw new HttpError(`Backup failed reading ${t}: ${error.message}`, 500);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    tables[t] = rows;
  }
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  return { created_at: new Date().toISOString(), version: 1, counts, tables };
}

async function storeBackup() {
  const b = await makeBackup();
  const name = `backup-${b.created_at.slice(0, 10)}-${Date.now()}.json`;
  const { error } = await admin.storage.from("backups").upload(name, new Blob([JSON.stringify(b)], { type: "application/json" }), { contentType: "application/json" });
  if (error) throw new HttpError(`Backup failed saving: ${error.message}`, 500);
  const { data: files } = await admin.storage.from("backups").list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
  const old = (files ?? []).map((f) => f.name).filter((n) => n.startsWith("backup-")).sort().reverse().slice(KEEP_BACKUPS);
  if (old.length) await admin.storage.from("backups").remove(old);
  await admin.from("app_settings").upsert({ key: "last_backup", value: b.created_at });
  return { name, counts: b.counts };
}

// ---------- actions ----------
type Handler = (req: Request, body: any) => Promise<Response>;

const actions: Record<string, Handler> = {
  // Called by the site's scheduled job (Mon/Wed/Fri). Keeps the database awake and makes a backup once a week.
  // Safe to be public: it returns nothing sensitive and backs up at most once every 6 days.
  async maintenance() {
    const { data: last } = await admin.from("app_settings").select("value").eq("key", "last_backup").maybeSingle();
    const due = !last || Date.now() - Date.parse(last.value) > 6 * 24 * 3600 * 1000;
    if (due) await storeBackup();
    return json({ ok: true, backed_up: due });
  },

  async backup_status(req) {
    const me = await currentUser(req);
    if (!(await isAgencyAdmin(me.id))) return fail("Only agency admins can see backups.", 403);
    const { data: last } = await admin.from("app_settings").select("value").eq("key", "last_backup").maybeSingle();
    const { data: files } = await admin.storage.from("backups").list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
    return json({ last_backup: last?.value ?? null, kept: (files ?? []).filter((f) => f.name.startsWith("backup-")).length });
  },

  // A fresh full backup, downloaded straight to the admin's computer
  async backup_download(req) {
    const me = await currentUser(req);
    if (!(await isAgencyAdmin(me.id))) return fail("Only agency admins can download backups.", 403);
    const b = await makeBackup();
    return new Response(JSON.stringify(b, null, 1), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="email-video-backup-${b.created_at.slice(0, 10)}.json"` },
    });
  },

  async setup_status() {
    const { count } = await admin.from("agency_admins").select("user_id", { count: "exact", head: true });
    return json({ needsSetup: (count ?? 0) === 0, streamConnected: !!(CF_ACCOUNT && CF_TOKEN) });
  },

  // Confirms the Cloudflare details work (no secrets returned)
  async stream_check() {
    if (!CF_ACCOUNT || !CF_TOKEN) {
      return json({ ok: false, accountIdSet: !!CF_ACCOUNT, tokenSet: !!CF_TOKEN, error: "Secrets missing" });
    }
    const tokenLooksWrong = /\s|curl|bearer|https?:/i.test(CF_TOKEN);
    const accountLooksWrong = !/^[0-9a-f]{32}$/i.test(CF_ACCOUNT);
    if (tokenLooksWrong || accountLooksWrong) {
      return json({ ok: false, tokenLooksWrong, accountLooksWrong, error: "A secret value isn't in the expected format" });
    }
    try {
      await cf("");
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: scrub((e as Error).message) });
    }
  },

  async setup(_req, body) {
    const { count } = await admin.from("agency_admins").select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return fail("Setup has already been done.", 403);
    const { data: code } = await admin.from("app_settings").select("value").eq("key", "setup_code").maybeSingle();
    if (!code || String(body.code ?? "").trim().toUpperCase() !== code.value) return fail("That setup code isn't right.", 403);
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) return fail("Enter a valid email and a password of at least 12 characters.");
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

  // Self-serve: a newly signed-up (email-confirmed) user creates their own trial workspace
  async create_workspace(req, body) {
    const me = await currentUser(req);
    if (!me.email_confirmed_at) return fail("Please confirm your email address first.", 403);
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (name.length < 2) return fail("Enter your organisation's name.");
    if (!(await isAgencyAdmin(me.id))) {
      const { count } = await admin.from("organisations").select("id", { count: "exact", head: true }).eq("created_by", me.id);
      if ((count ?? 0) >= 1) return fail("You already have a workspace.", 409);
    }
    const base = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";
    let slug = base;
    for (let i = 2; i < 60; i++) {
      const { data } = await admin.from("organisations").select("id").eq("slug", slug).maybeSingle();
      if (!data) break;
      slug = `${base}-${i}`;
    }
    const { data: org, error } = await admin.from("organisations")
      .insert({ name, slug, plan: "trial", self_serve: true, created_by: me.id }).select("*").single();
    if (error || !org) { console.error(error); return fail("Couldn't create the workspace. Please try again.", 500); }
    const { error: mErr } = await admin.from("memberships").insert({ org_id: org.id, user_id: me.id, email: me.email, role: "owner" });
    if (mErr) { await admin.from("organisations").delete().eq("id", org.id); return fail("Couldn't create the workspace. Please try again.", 500); }
    return json({ org });
  },

  // Right to erasure: deletes the login, plus any self-serve workspace where this user is the only member
  async delete_account(req, body) {
    const me = await currentUser(req);
    if (String(body.confirm ?? "") !== "DELETE") return fail("Type DELETE to confirm.");
    if (await isAgencyAdmin(me.id)) return fail("Agency admin logins can't be deleted from here.", 403);
    const { data: mems } = await admin.from("memberships").select("org_id").eq("user_id", me.id);
    for (const m of mems ?? []) {
      const { data: org } = await admin.from("organisations").select("id, self_serve").eq("id", m.org_id).maybeSingle();
      if (!org?.self_serve) continue;
      const { count } = await admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("org_id", org.id);
      if ((count ?? 0) > 1) continue;
      const { data: vids } = await admin.from("videos").select("stream_uid, pending_uid").eq("org_id", org.id);
      for (const v of vids ?? []) {
        for (const uid of [v.stream_uid, v.pending_uid]) {
          if (uid && CF_ACCOUNT && CF_TOKEN) { try { await cf(`/${uid}`, { method: "DELETE" }); } catch { /* already gone */ } }
        }
      }
      for (const bucket of ["brand", "email-images"]) {
        const { data: files } = await admin.storage.from(bucket).list(org.id, { limit: 1000 });
        if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${org.id}/${f.name}`));
      }
      await admin.from("organisations").delete().eq("id", org.id); // videos, views, clicks, fixtures cascade
    }
    const { error } = await admin.auth.admin.deleteUser(me.id);
    if (error) { console.error(error); return fail("Couldn't delete the account. Please contact us.", 500); }
    return json({ ok: true });
  },

  async create_user(req, body) {
    const me = await currentUser(req);
    if (!(await isAgencyAdmin(me.id))) return fail("Only agency admins can add people.", 403);
    const email = String(body.email ?? "").trim().toLowerCase();
    const orgId = body.org_id ? String(body.org_id) : null;
    const role = body.role === "owner" ? "owner" : "member";
    const makeAdmin = body.agency_admin === true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email.");
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
    const replaceId = body.replace_video_id ? String(body.replace_video_id) : null;
    const { data: orgRow } = await admin.from("organisations").select("plan").eq("id", orgId).maybeSingle();
    if (!orgRow) return fail("Organisation not found.", 404);
    const trial = orgRow.plan === "trial";
    if (trial && !replaceId) {
      const { count } = await admin.from("videos").select("id", { count: "exact", head: true }).eq("org_id", orgId);
      if ((count ?? 0) >= TRIAL.videos) return fail(`The free trial includes ${TRIAL.videos} videos. Delete one or upgrade to add more.`, 402);
    }
    let target: Record<string, any> | null = null;
    if (replaceId) {
      const t = await videoForUser(me.id, replaceId);
      target = t;
      if (t.org_id !== orgId) return fail("That video belongs to a different organisation.", 403);
    }
    const r = await cf("/direct_upload", {
      method: "POST",
      body: JSON.stringify({ maxDurationSeconds: trial ? TRIAL.maxSeconds : 3600, requireSignedURLs: true, meta: { name: target?.title ?? title, org: orgId } }),
    });
    if (target) {
      // Old upload that never finished? Just swap it straight in.
      if (target.status !== "ready") {
        const { data } = await admin.from("videos").update({ stream_uid: r.uid, status: "uploading", pending_uid: null, playback_host: null }).eq("id", target.id).select("*").single();
        if (target.stream_uid) { try { await cf(`/${target.stream_uid}`, { method: "DELETE" }); } catch { /* gone */ } }
        return json({ uploadURL: r.uploadURL, video: data });
      }
      if (target.pending_uid) { try { await cf(`/${target.pending_uid}`, { method: "DELETE" }); } catch { /* gone */ } }
      const { data } = await admin.from("videos").update({ pending_uid: r.uid }).eq("id", target.id).select("*").single();
      return json({ uploadURL: r.uploadURL, video: data });
    }
    const { data, error } = await admin.from("videos")
      .insert({ org_id: orgId, title, stream_uid: r.uid, status: "uploading", created_by: me.id })
      .select("*").single();
    if (error) return fail(error.message, 500);
    return json({ uploadURL: r.uploadURL, video: data });
  },

  async cancel_replace(req, body) {
    const me = await currentUser(req);
    const v = await videoForUser(me.id, String(body.video_id));
    if (v.pending_uid) { try { await cf(`/${v.pending_uid}`, { method: "DELETE" }); } catch { /* gone */ } }
    const { data } = await admin.from("videos").update({ pending_uid: null }).eq("id", v.id).select("*").single();
    return json({ video: data });
  },

  async captions(req, body) {
    const me = await currentUser(req);
    const v = await videoForUser(me.id, String(body.video_id));
    const enable = body.enable === true;
    if (enable) {
      if (v.status !== "ready") return fail("Wait until the video has finished processing.", 409);
      try { await cf(`/${v.stream_uid}/captions/en`, { method: "DELETE" }); } catch { /* none yet */ }
      await cf(`/${v.stream_uid}/captions/en/generate`, { method: "POST" });
      const { data } = await admin.from("videos").update({ captions: true, captions_status: "generating" }).eq("id", v.id).select("*").single();
      return json({ video: data });
    }
    try { await cf(`/${v.stream_uid}/captions/en`, { method: "DELETE" }); } catch { /* none */ }
    const { data } = await admin.from("videos").update({ captions: false, captions_status: null }).eq("id", v.id).select("*").single();
    return json({ video: data });
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
    return new Response(res.body, { headers: { "Content-Type": "image/jpeg" } });
  },

  async delete_video(req, body) {
    const me = await currentUser(req);
    const v = await videoForUser(me.id, String(body.video_id));
    for (const uid of [v.stream_uid, v.pending_uid]) {
      if (uid && CF_ACCOUNT && CF_TOKEN) { try { await cf(`/${uid}`, { method: "DELETE" }); } catch (_) { /* already gone */ } }
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
      corner_style: v?.corner_style || org.corner_style || "rounded",
      fixture_size: v?.fixture_size || org.fixture_size || "medium",
      fixture_badge_color: hex(org.fixture_badge_color),
      ticket_button_color: hex(org.ticket_button_color),
      card_color: hex(org.card_color),
      privacy_url: safeUrl(org.privacy_url),
    };
    if (!v) return json({ state: "not_found", brand });

    // Each video owns its page content. Blank = not shown.
    const buttons = (Array.isArray(v.buttons) ? v.buttons : [])
      .map((b: any) => ({ label: String(b?.label ?? "").trim().slice(0, 60), url: safeUrl(b?.url), style: b?.style === "secondary" ? "secondary" : "primary", color: hex(b?.color) }))
      .filter((b: any) => b.label && b.url)
      .slice(0, 8);
    let fixtures: unknown[] = [];
    if (v.show_fixtures) {
      const cutoff = Date.now() - 2 * 3600 * 1000;
      const { data: fx } = await admin.from("fixtures").select("id, kickoff, time_tbc, title, home_away, competition, venue, ticket_url, image_url")
        .eq("org_id", org.id).gte("kickoff", new Date(cutoff - 24 * 3600 * 1000).toISOString())
        .order("kickoff", { ascending: true }).limit(12);
      fixtures = (fx ?? [])
        .filter((f: any) => Date.parse(f.kickoff) + (f.time_tbc ? 24 * 3600 * 1000 : 0) >= cutoff)
        .slice(0, 6)
        .map((f: any) => ({ ...f, ticket_url: safeUrl(f.ticket_url), image_url: safeUrl(f.image_url) }));
    }
    const sponsors = v.show_sponsors
      ? (Array.isArray(org.sponsors) ? org.sponsors : [])
          .map((sp: any) => ({ name: String(sp?.name ?? "").slice(0, 80), logo_url: safeUrl(sp?.logo_url), url: safeUrl(sp?.url) }))
          .filter((sp: any) => sp.logo_url)
      : [];
    const page = {
      title: v.title,
      headline: v.headline ?? "",
      message: v.message ?? "",
      body: v.body ?? "",
      buttons,
      fixtures,
      fixtures_title: v.fixtures_title || "Upcoming fixtures",
      fixtures_title_size: ["small", "medium", "large", "xl"].includes(v.fixtures_title_size) ? v.fixtures_title_size : "medium",
      feature_image_url: safeUrl(v.feature_image_url),
      feature_image_link: safeUrl(v.feature_image_link),
      sponsors,
      sponsors_title: org.sponsors_title || "Our partners",
      countdown: v.countdown ?? "none",
      live_from: v.live_from,
      live_until: v.switched_off ? null : v.live_until,
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

    // Free trial: cap plays per calendar month
    if (!preview && org.plan === "trial") {
      const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
      const { data: ids } = await admin.from("videos").select("id").eq("org_id", org.id);
      const { count } = await admin.from("views").select("id", { count: "exact", head: true })
        .in("video_id", (ids ?? []).map((x: any) => x.id)).gte("started_at", start.toISOString());
      if ((count ?? 0) >= TRIAL.playsPerMonth) return json({ state: "unavailable", brand, page });
    }

    let fresh = v;
    if (!fresh.playback_host) fresh = await syncFromStream(v);
    if (!fresh.playback_host) return json({ state: "processing", brand, page });

    const nowS = Math.floor(now / 1000);
    let exp = nowS + 4 * 3600;
    if (!preview && v.live_until) exp = Math.min(exp, Math.floor(Date.parse(v.live_until) / 1000) + 15 * 60);
    const token = await playbackToken(v.stream_uid, exp);
    const base = `https://${fresh.playback_host}/${token}`;

    let viewId: string | null = null;
    // Viewers who chose "Don't count my visits" are not recorded at all
    if (!preview && body.no_track !== true) {
      // Same viewer re-opening within 30 minutes counts as the same view
      const { data: recent } = await admin.from("views").select("id").eq("video_id", v.id).eq("viewer_id", viewerId)
        .gte("started_at", new Date(now - 30 * 60 * 1000).toISOString()).order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (recent && viewerId !== "anon") {
        viewId = recent.id;
      } else {
        viewId = crypto.randomUUID();
        await admin.from("views").insert({ id: viewId, video_id: v.id, viewer_id: viewerId, device: String(body.device ?? "").slice(0, 20) || null });
      }
    }
    return json({
      state, brand, page, view_id: viewId, vid: v.id,
      player: {
        iframe: `${base}/iframe`,
        poster: `${base}/thumbnails/thumbnail.jpg?time=1s&height=720`,
        duration: fresh.duration,
        captions: !!(fresh.captions && fresh.captions_status === "ready"),
      },
    });
  },

  async click(_req, body) {
    const vid = String(body.vid ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(vid)) return fail("bad video");
    const kind = ["button", "fixture", "sponsor", "link"].includes(body.kind) ? body.kind : "link";
    const label = String(body.label ?? "").trim().slice(0, 120);
    if (!label) return fail("missing label");
    const url = String(body.url ?? "").slice(0, 500) || null;
    const viewId = /^[0-9a-f-]{36}$/i.test(String(body.view_id ?? "")) ? String(body.view_id) : null;
    const { data: v } = await admin.from("videos").select("id").eq("id", vid).maybeSingle();
    if (!v) return fail("bad video", 404);
    // Basic flood protection: at most 20 clicks per view
    if (viewId) {
      const { count } = await admin.from("clicks").select("id", { count: "exact", head: true }).eq("view_id", viewId);
      if ((count ?? 0) >= 20) return json({ ok: true });
    }
    await admin.from("clicks").insert({ video_id: vid, view_id: viewId, kind, label, url });
    return json({ ok: true });
  },

  // Shareable stats page for a client (no login): /r/<token>
  async report(_req, body) {
    const token = String(body.token ?? "");
    if (token.length < 20) return json({ state: "not_found" });
    const { data: org } = await admin.from("organisations").select("*").eq("report_token", token).maybeSingle();
    if (!org) return json({ state: "not_found" });
    const { data: vids } = await admin.from("videos").select("id, title, duration, created_at, live_from, live_until, switched_off, status")
      .eq("org_id", org.id).order("created_at", { ascending: false });
    const { data: stats } = await admin.rpc("video_stats_v2", { p_org: org.id });
    const byId: Record<string, any> = {};
    (stats ?? []).forEach((r: any) => (byId[r.video_id] = r));
    const ids = (vids ?? []).map((v: any) => v.id);
    const { data: clickRows } = ids.length
      ? await admin.from("clicks").select("video_id, kind, label").in("video_id", ids).limit(50000)
      : { data: [] as any[] };
    const clicksBy: Record<string, Record<string, number>> = {};
    (clickRows ?? []).forEach((c: any) => {
      clicksBy[c.video_id] ??= {};
      clicksBy[c.video_id][c.label] = (clicksBy[c.video_id][c.label] ?? 0) + 1;
    });
    return json({
      state: "ok",
      brand: { name: org.name, logo_url: org.logo_url, bg_color: org.bg_color, text_color: org.text_color, accent_color: org.accent_color, font: org.font, corner_style: org.corner_style },
      videos: (vids ?? []).filter((v: any) => v.status === "ready").map((v: any) => ({
        title: v.title, duration: v.duration, created_at: v.created_at, live_from: v.live_from, live_until: v.live_until, switched_off: v.switched_off,
        plays: Number(byId[v.id]?.plays ?? 0), viewers: Number(byId[v.id]?.viewers ?? 0),
        avg_seconds: Number(byId[v.id]?.avg_seconds ?? 0), total_seconds: Number(byId[v.id]?.total_seconds ?? 0),
        completions: Number(byId[v.id]?.completions ?? 0),
        clicks: Object.entries(clicksBy[v.id] ?? {}).map(([label, n]) => ({ label, clicks: n })).sort((a, b) => b.clicks - a.clicks),
      })),
      generated_at: new Date().toISOString(),
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

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return fail("Use POST", 405);
  const raw = await req.text();
  if (raw.length > 20_000) return fail("Request too large", 413);
  let body: any = {};
  try { body = JSON.parse(raw || "{}"); } catch { /* empty */ }
  if (typeof body !== "object" || body === null) body = {};
  const fn = actions[String(body.action ?? "")];
  if (!fn) return fail("Unknown action", 404);
  try {
    return await fn(req, body);
  } catch (e) {
    if (e instanceof HttpError) return fail(scrub(e.message), e.status);
    console.error(e);
    return fail("Something went wrong.", 500);
  }
}

Deno.serve(async (req) => {
  const res = await handle(req);
  for (const [k, v] of Object.entries(corsFor(req))) res.headers.set(k, v);
  return res;
});
