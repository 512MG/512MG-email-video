// Serves the dashboard/watch pages, and runs a small scheduled job:
// Mon/Wed/Fri it pings the server, which keeps the Supabase database awake
// and makes the weekly backup.
const API = "https://moumgoefibpwrjyzzpqd.supabase.co/functions/v1/api";

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: unknown, _env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ctx.waitUntil(
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://512mg-email-video.barkery.workers.dev" },
        body: JSON.stringify({ action: "maintenance" }),
      }).then(async (r) => console.log("maintenance", r.status, await r.text())),
    );
  },
};
