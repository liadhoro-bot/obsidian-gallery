do $$
declare
  v_columns text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    return;
  end if;

  revoke update on table public.profiles from anon, authenticated;

  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name not in (
      'id',
      'is_admin',
      'created_at'
    );

  if v_columns is not null then
    execute format('grant update (%s) on public.profiles to authenticated', v_columns);
  end if;
end $$;
