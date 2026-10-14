Migrations applied to the `email-video` project (moumgoefibpwrjyzzpqd), in order:

1. `core_schema` – organisations, memberships, videos, views, agency_admins, stream_keys, RLS, storage buckets (`brand`, `email-images`), `video_stats()`.
2. `tighten_function_grants` – helper functions not callable anonymously.
3. `app_settings_setup_code` – private settings table holding the one-time setup code.

See the Supabase dashboard (Database → Migrations) for the exact SQL.
