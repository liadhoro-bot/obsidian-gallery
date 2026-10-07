update public.contests
set
  voting_open_at = '2026-10-16T00:00:00+03:00',
  voting_close_at = '2026-10-24T23:59:59.999+03:00',
  updated_at = now()
where slug = 'best-painting-guide';

update public.contests
set
  submissions_close_at = least(submissions_close_at, '2026-09-30T23:59:59.999+03:00'::timestamptz),
  voting_close_at = least(voting_close_at, '2026-10-06T23:59:59.999+03:00'::timestamptz),
  updated_at = now()
where slug = 'path-to-glory-coolest-army';
