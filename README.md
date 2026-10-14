# Email Video

Host videos for email campaigns on branded, unlisted watch pages.

- **Dashboard**: organisations (one per client), logins, video uploads, branding with live preview, email image + HTML snippet, stats.
- **Watch page**: `/v/<organisation>/<video>`, in the client's branding, with no public view counts and hidden from search engines.
- **Live window**: each video can go live and expire at set times, or be switched off instantly. Outside the window, viewers see a branded "not live yet" or "expired" page and the video itself stops playing (signed Cloudflare Stream URLs).

## Stack

| Part | Where |
| --- | --- |
| Front end (React + Vite + Tailwind) | Cloudflare Workers static assets (`wrangler.jsonc`) |
| Logins, data, stats, image storage | Supabase project `email-video` (`moumgoefibpwrjyzzpqd`, London) |
| Server logic | Supabase Edge Function `api` (`supabase/functions/api`) |
| Video storage and playback | Cloudflare Stream (signed URLs) |

## One-time setup

1. **Cloudflare Stream secrets**: in Supabase → Edge Functions → Secrets, add
   - `CF_ACCOUNT_ID`: your Cloudflare account ID
   - `CF_STREAM_TOKEN`: an API token with **Account → Stream → Edit**
2. **Deploy the site**: Cloudflare → Workers & Pages → Create → Import a repository → `512MG/email-video`.
   Build command `npm run build`, deploy command `npx wrangler deploy`.
3. **First admin**: open `/setup` on the site and enter the one-time setup code. After that, `/setup` stops working.

## Roles

- **Agency admin**: sees every organisation, creates organisations, adds and removes client logins, resets passwords.
- **Client (owner/member)**: sees only their organisation; can upload videos, edit branding, set live windows and see stats.

Client logins are created from the organisation's **People** tab. A password is generated and shown once, so send it to the client. They can change it under **Account**.

## Limits (v1)

- Uploads up to 200 MB per file (direct upload). Larger files need resumable (tus) uploads, which isn't built yet.
- Expiry uses one shared window per video, not per viewer.
- Links can be forwarded while a video is live. Expiry is the protection.

## Local development

```bash
npm install
npm run dev
```
