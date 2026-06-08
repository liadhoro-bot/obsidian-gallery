alter table public.units
  add column if not exists theme_id uuid references public.themes(id) on delete set null;

create index if not exists units_user_id_theme_id_idx
on public.units (user_id, theme_id);
