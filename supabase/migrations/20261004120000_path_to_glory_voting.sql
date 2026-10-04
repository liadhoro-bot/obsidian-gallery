-- Keep the existing nominees and voter allowlist. Times are Israel local time.
update public.contests set
  submissions_open_at = '2026-09-15T00:00:00+03:00',
  submissions_close_at = '2026-09-30T23:59:59.999+03:00',
  voting_open_at = '2026-10-04T00:00:00+03:00',
  voting_close_at = '2026-10-06T23:59:59.999+03:00',
  results_target_at = '2026-10-06T23:59:59.999+03:00',
  voting_method = 'ranked',
  minimum_selections_per_ballot = 2,
  maximum_selections_per_ballot = 2,
  require_exact_selection_count = true,
  allow_ballot_changes = false,
  allow_self_vote = false,
  voter_access_mode = 'allowlist',
  show_live_results = false,
  updated_at = now()
where slug = 'path-to-glory-coolest-army';

