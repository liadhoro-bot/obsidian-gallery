-- The dashboard hero ("Featured") could only ever show a unit. Let a user
-- feature a whole project there instead. A user has at most one featured
-- thing: featuring a project clears units.is_featured for that user, and
-- featuring a unit clears projects.is_featured (both done in the server
-- actions). The partial unique index guards the one-per-user invariant.
alter table public.projects
  add column if not exists is_featured boolean not null default false;

create unique index if not exists projects_user_id_featured_unique_idx
on public.projects (user_id)
where is_featured = true;
