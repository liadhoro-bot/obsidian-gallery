-- Six public tables had row-level security disabled and full grants to the
-- anon and authenticated roles, so anyone holding the public anon key could
-- read, change or delete their rows. None of them was created by a
-- migration, so nothing ever secured them.

-- Unit progress: only the unit's owner may read or write it, matching the
-- owner-only policies on public.units. The dashboard triggers on these
-- tables are security definer and keep working.
alter table public.unit_progress_steps enable row level security;
alter table public.unit_stage_progress enable row level security;

drop policy if exists "Owners manage their unit progress steps" on public.unit_progress_steps;
create policy "Owners manage their unit progress steps"
on public.unit_progress_steps
for all
to authenticated
using (exists (select 1 from public.units u where u.id = unit_id and u.user_id = auth.uid()))
with check (exists (select 1 from public.units u where u.id = unit_id and u.user_id = auth.uid()));

drop policy if exists "Owners manage their unit stage progress" on public.unit_stage_progress;
create policy "Owners manage their unit stage progress"
on public.unit_stage_progress
for all
to authenticated
using (exists (select 1 from public.units u where u.id = unit_id and u.user_id = auth.uid()))
with check (exists (select 1 from public.units u where u.id = unit_id and u.user_id = auth.uid()));

revoke all on public.unit_progress_steps from anon;
revoke all on public.unit_stage_progress from anon;
revoke truncate, references, trigger on public.unit_progress_steps from authenticated;
revoke truncate, references, trigger on public.unit_stage_progress from authenticated;

-- Catalog backups and two unused tables: server (service role) only.
alter table public.paint_catalog_backup_game_color_urls enable row level security;
alter table public.paint_catalog_backup_xpress_urls enable row level security;
alter table public.user_paint_inventory enable row level security;
alter table public.user_paints enable row level security;

revoke all on public.paint_catalog_backup_game_color_urls from anon, authenticated;
revoke all on public.paint_catalog_backup_xpress_urls from anon, authenticated;
revoke all on public.user_paint_inventory from anon, authenticated;
revoke all on public.user_paints from anon, authenticated;
