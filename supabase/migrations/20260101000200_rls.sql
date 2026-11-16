-- =====================================================================
-- Row Level Security, storage and realtime configuration
-- =====================================================================
-- Model
--   * anon / authenticated (incl. anonymous-sign-in players) can READ public configuration only.
--   * Players can read ONLY their own rows. They can never write scores, progress or sessions —
--     all writes go through Edge Functions using the service role.
--   * Admins (rows in public.admins) can manage draft content. Published configs, score records,
--     submissions and sessions are read-only even for admins (changes go through audited functions).
--   * Public dashboards read through the dashboard_snapshot() RPC, which exposes only display
--     name, school and progress.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'admins','game_settings','dashboard_settings','game_sessions','robot_assets','scene_assets','worlds','levels',
    'level_translations','missions','hints','lessons','lesson_translations','block_definitions','i18n_overrides',
    'published_configs','players','player_sessions','player_level_progress','submissions','lesson_progress',
    'score_records','rewards','reward_claims','game_events','audit_logs','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- public read (configuration shown to everyone) -------------------
create policy "public read settings"        on public.game_settings      for select to anon, authenticated using (true);
create policy "public read dashboard cfg"   on public.dashboard_settings for select to anon, authenticated using (true);
create policy "public read sessions"        on public.game_sessions      for select to anon, authenticated using (true);
-- Published snapshots are NOT publicly readable: players fetch their pinned version through the
-- player-action Edge Function, which strips hints and enforces version pinning.
create policy "admin read published"        on public.published_configs  for select to authenticated using (public.is_admin());
create policy "public read robots"          on public.robot_assets       for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read scenes"          on public.scene_assets       for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read rewards"         on public.rewards            for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read i18n overrides"  on public.i18n_overrides     for select to anon, authenticated using (true);

-- ---------- admin-managed draft content (full control) -----------------------
do $$
declare t text;
begin
  foreach t in array array[
    'game_settings','dashboard_settings','game_sessions','robot_assets','scene_assets','worlds','levels',
    'level_translations','missions','hints','lessons','lesson_translations','block_definitions','i18n_overrides','rewards'
  ] loop
    execute format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- draft-only tables: players must NOT read them (they read the published snapshot instead)
create policy "admin read worlds"              on public.worlds              for select to authenticated using (public.is_admin());
create policy "admin read levels"              on public.levels              for select to authenticated using (public.is_admin());
create policy "admin read level translations"  on public.level_translations  for select to authenticated using (public.is_admin());
create policy "admin read missions"            on public.missions            for select to authenticated using (public.is_admin());
create policy "admin read hints"               on public.hints               for select to authenticated using (public.is_admin());
create policy "admin read lessons"             on public.lessons             for select to authenticated using (public.is_admin());
create policy "admin read lesson translations" on public.lesson_translations for select to authenticated using (public.is_admin());
create policy "admin read blocks"              on public.block_definitions   for select to authenticated using (public.is_admin());

-- ---------- admins table ------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.role = 'SUPER_ADMIN');
$$;
grant execute on function public.is_super_admin() to authenticated;

create policy "admin read admins"   on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "super admin insert admins" on public.admins for insert to authenticated with check (public.is_super_admin());
create policy "super admin update admins" on public.admins for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super admin delete admins" on public.admins for delete to authenticated using (public.is_super_admin());

-- ---------- player-owned data (read own, admins read all, nobody writes directly) --
create policy "own player"            on public.players               for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
create policy "admin delete players"  on public.players               for delete to authenticated using (public.is_admin());
create policy "own player session"    on public.player_sessions       for select to authenticated using (public.owns_player_session(id) or public.is_admin());
create policy "own level progress"    on public.player_level_progress for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own submissions"       on public.submissions           for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own lesson progress"   on public.lesson_progress       for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own score records"     on public.score_records         for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own reward claims"     on public.reward_claims         for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());

-- ---------- admin-only read ------------------------------------------------------
create policy "admin read events"     on public.game_events  for select to authenticated using (public.is_admin());
create policy "admin read audit"      on public.audit_logs   for select to authenticated using (public.is_admin());
-- rate_limits: no policies at all => only the service role can touch it.

-- ---------- column hardening: even with RLS, forbid direct DML by players -----------
revoke insert, update, delete, truncate on
  public.players, public.player_sessions, public.player_level_progress, public.submissions,
  public.lesson_progress, public.score_records, public.reward_claims, public.game_events,
  public.audit_logs, public.rate_limits, public.published_configs
from anon, authenticated;
-- admins may delete players (GDPR-style cleanup / session reset)
grant delete on public.players to authenticated;
revoke all on public.rate_limits from anon, authenticated;

-- ---------- storage -----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-assets', 'game-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "game assets public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'game-assets');
create policy "game assets admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'game-assets' and public.is_admin());
create policy "game assets admin update" on storage.objects for update to authenticated
  using (bucket_id = 'game-assets' and public.is_admin()) with check (bucket_id = 'game-assets' and public.is_admin());
create policy "game assets admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'game-assets' and public.is_admin());

-- ---------- realtime ---------------------------------------------------------------------
-- Global (live) configuration changes are pushed to clients through postgres_changes.
-- Gameplay events travel over Broadcast; presence tracks who is online.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.game_settings, public.dashboard_settings, public.game_sessions, public.i18n_overrides;
  end if;
end $$;
