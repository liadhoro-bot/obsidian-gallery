update public.contests
set
  publication_status = 'published',
  visibility = 'private',
  published_at = coalesce(published_at, now())
where slug in ('path-to-glory-coolest-army', 'best-painting-guide');

delete from public.contest_organizers co
using public.contests c
where co.contest_id = c.id
  and c.slug in ('path-to-glory-coolest-army', 'best-painting-guide')
  and co.user_id <> c.created_by;

insert into public.contest_organizers (contest_id, user_id, role)
select id, created_by, 'owner'
from public.contests
where slug in ('path-to-glory-coolest-army', 'best-painting-guide')
on conflict (contest_id, user_id) do update set role = 'owner';
