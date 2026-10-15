Migrations applied to the `email-video` project (moumgoefibpwrjyzzpqd), in order:

1. `core_schema` – organisations, memberships, videos, views, agency_admins, stream_keys, RLS, storage buckets (`brand`, `email-images`), `video_stats()`.
2. `tighten_function_grants` – helper functions not callable anonymously.
3. `app_settings_setup_code` – private settings table holding the one-time setup code.

See the Supabase dashboard (Database → Migrations) for the exact SQL.
4. `storage_select_policy_and_types` – members can read their org's files (needed for uploads), logo limit 10 MB, AVIF allowed.
5. `video_body_and_buttons` – per-video `body` (text below the video) and `buttons` (jsonb list). Organisation-level headline/message/button are no longer used.
6. `fixtures_clicks_sponsors_reports` – corner style, sponsors + report link on organisations; fixtures table; clicks table; per-video fixtures/sponsors/countdown/captions/replace fields; `video_stats_v2` (with clicks) and `click_breakdown`.
7. `fixture_time_tbc_and_colours` – fixtures.time_tbc (kick-off not confirmed); optional organisation colours for fixture date block, Tickets buttons and cards/countdown.
8. `video_corner_style` – per-video corner override.
9. `security_hardening` – least-privilege grants (anon: none; videos insert server-only), two-step verification enforced in RLS (mfa_ok), triggers protecting system columns on videos and org name/slug, fixture text limits.
10. `lock_down_pg_net` – attempted revoke of pg_net from API roles (grants owned by supabase_admin; schema isn't exposed by the API).
