create or replace function public.get_vault_catalog_filter_rows()
returns table (
  brand text,
  line text
)
language sql
security definer
set search_path = public
as $$
  select distinct
    nullif(btrim(brand), '') as brand,
    nullif(btrim(line), '') as line
  from public.paint_catalog
  where is_active = true
    and (
      nullif(btrim(brand), '') is not null
      or nullif(btrim(line), '') is not null
    )
  order by 1, 2;
$$;

grant execute on function public.get_vault_catalog_filter_rows() to authenticated;
