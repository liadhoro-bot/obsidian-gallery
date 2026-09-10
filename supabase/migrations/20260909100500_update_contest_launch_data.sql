update public.contests
set
  prize_first_place = '₪1,200',
  prize_second_place = '₪400',
  how_it_works = '[
    {"title": "Create", "body": "Publish as many painting guides as you like during the contest."},
    {"title": "Inspire", "body": "Your guides become part of your creator showcase."},
    {"title": "Earn the vote", "body": "Each member votes for their 1st and 2nd favorite creators (2 and 1 points)."}
  ]'::jsonb,
  updated_at = now()
where slug = 'best-painting-guide';

update public.contests
set
  prize_first_place = '₪200 Geek Shelter Hobby Kit',
  prize_second_place = null,
  sponsor_name = 'Geek Shelter',
  how_it_works = '[
    {"title": "Nominate", "body": "Submit one army from your existing projects."},
    {"title": "Showcase", "body": "Your army appears in the gallery for the whole campaign group to see."},
    {"title": "Earn the vote", "body": "Each participant votes for their top 2 armies (2 and 1 points)."}
  ]'::jsonb,
  submissions_open_at = '2026-09-13T00:00:00+03:00',
  submissions_close_at = '2026-09-26T23:59:59+03:00',
  voting_open_at = '2026-09-27T00:00:00+03:00',
  voting_close_at = '2026-09-30T23:59:59+03:00',
  results_target_at = '2026-10-01T09:00:00+03:00',
  updated_at = now()
where slug = 'path-to-glory-coolest-army';
