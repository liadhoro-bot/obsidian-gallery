-- Emits SQL that recreates objects living outside the public schema:
-- custom triggers on auth.users and RLS policies on storage.objects.
-- Empty search_path makes pg_get_triggerdef schema-qualify the trigger function.
set search_path = '';
select 'drop trigger if exists ' || quote_ident(t.tgname) || ' on auth.users; '
       || pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

select format('drop policy if exists %I on storage.%I; create policy %I on storage.%I as %s for %s to %s%s%s;',
  policyname, tablename, policyname, tablename, permissive, cmd,
  array_to_string(roles, ', '),
  coalesce(' using (' || qual || ')', ''),
  coalesce(' with check (' || with_check || ')', ''))
from pg_policies
where schemaname = 'storage';
