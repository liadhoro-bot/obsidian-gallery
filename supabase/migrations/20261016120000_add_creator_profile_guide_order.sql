-- Optional organizer-chosen order for a creator's guides on their contest
-- creator page. Listed guide ids come first in this order; the rest follow
-- in their usual order.
alter table public.contest_creator_profiles
  add column if not exists guide_order uuid[] not null default '{}';
