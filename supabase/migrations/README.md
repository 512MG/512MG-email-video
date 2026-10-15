Migrations applied to the `email-video` project (moumgoefibpwrjyzzpqd), in order:

1. `core_schema` – organisations, memberships, videos, views, agency_admins, stream_keys, RLS, storage buckets (`brand`, `email-images`), `video_stats()`.
2. `tighten_function_grants` – helper functions not callable anonymously.
3. `app_settings_setup_code` – private settings table holding the one-time setup code.

See the Supabase dashboard (Database → Migrations) for the exact SQL.
4. `storage_select_policy_and_types` – members can read their org's files (needed for uploads), logo limit 10 MB, AVIF allowed.
5. `video_body_and_buttons` – per-video `body` (text below the video) and `buttons` (jsonb list). Organisation-level headline/message/button are no longer used.
