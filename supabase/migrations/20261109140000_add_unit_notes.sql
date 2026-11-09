-- Unit Painting Notes: any number of notes per unit, each editable.
-- units.notes stays as the unit's Paint Mode note (shown first in the list);
-- unit_sessions.notes stay with their sessions. This table holds the notes
-- added from the unit page (and, later, from Paint Mode).
create table if not exists public.unit_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  -- The painting session a note was written in, when there was one.
  unit_session_id uuid references public.unit_sessions (id) on delete set null,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists unit_notes_user_unit_idx
  on public.unit_notes (user_id, unit_id, created_at desc);

alter table public.unit_notes enable row level security;

drop policy if exists "Users manage their own unit notes" on public.unit_notes;
create policy "Users manage their own unit notes"
on public.unit_notes
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.units u where u.id = unit_id and u.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.unit_notes to authenticated;
