update public.contests
set
  short_description = 'An open contest for the strongest painting guides in the Gallery.',
  description = 'The Best Painting Guide contest celebrates creativity, knowledge, and the spirit of sharing in our community. Create and publish painting guides during the launch month, then compete for the community vote.',
  rules_markdown = 'Users may enter eligible original painting guides created during the contest period. Ranked ballots must choose exactly two different creators: 1st place is worth 2 points and 2nd place is worth 1 point. Votes are for creators, not individual guides. Voters must have a verified email plus at least one project and one unit in the app.',
  max_nominations_per_user = 999,
  voting_method = 'ranked',
  minimum_selections_per_ballot = 2,
  maximum_selections_per_ballot = 2,
  require_exact_selection_count = true,
  allow_self_vote = false,
  show_live_results = false,
  updated_at = now()
where slug = 'best-painting-guide';
