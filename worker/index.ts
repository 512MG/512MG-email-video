// Serves the dashboard/watch pages, plus:
// - /img/<bucket>/<path>: images from Supabase storage, cached at Cloudflare so Supabase
//   only sends each image a handful of times (keeps us inside the free bandwidth allowance).
// - a small scheduled job: Mon/Wed/Fri it pings the server, which keeps the Supabase
//   database awake and makes the weekly backup.
const API = "https://moumgoefibpwrjyzzpqd.supabase.co/functions/v1/api";
const STORAGE = "https://moumgoefibpwrjyzzpqd.supabase.co/storage/v1/object/public/";
const IMG_PATH = /^\/img\/(brand|email-images)\/([A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(jpe?g|png|webp|gif|svg)$/i;
const YEAR = 31536000;

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}
type Ctx = { waitUntil: (p: Promise<unknown>) => void };

async function serveImage(request: Request, url: URL, ctx: Ctx): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  if (!IMG_PATH.test(url.pathname) || url.pathname.includes("..")) return new Response("Not found", { status: 404 });

  // Ignore query strings so nobody can bypass the cache with ?random
  const key = new Request(`${url.origin}${url.pathname}`, { method: "GET" });
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(key);
  if (hit) {
    const r = new Response(request.method === "HEAD" ? null : hit.body, hit);
    r.headers.set("X-Img-Cache", "HIT");
    return r;
  }

  const origin = await fetch(STORAGE + url.pathname.slice("/img/".length), {
    cf: { cacheEverything: true, cacheTtl: YEAR },
  } as RequestInit);
  if (!origin.ok) return new Response("Not found", { status: origin.status === 400 ? 404 : origin.status });

  const type = origin.headers.get("Content-Type") ?? "application/octet-stream";
  if (!type.startsWith("image/")) return new Response("Not found", { status: 404 });

  // File names include a timestamp, so a given URL never changes: safe to cache for a year.
  const headers = new Headers({
    "Content-Type": type,
    "Cache-Control": `public, max-age=${YEAR}, immutable`,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  if (type.includes("svg")) headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  const res = new Response(origin.body, { status: 200, headers });
  ctx.waitUntil(cache.put(key, res.clone()));
  const out = new Response(request.method === "HEAD" ? null : res.body, res);
  out.headers.set("X-Img-Cache", "MISS");
  return out;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/img/")) return serveImage(request, url, ctx);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: unknown, _env: Env, ctx: Ctx) {
    ctx.waitUntil(
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://512mg-email-video.barkery.workers.dev" },
        body: JSON.stringify({ action: "maintenance" }),
      }).then(async (r) => console.log("maintenance", r.status, await r.text())),
    );
  },
};
