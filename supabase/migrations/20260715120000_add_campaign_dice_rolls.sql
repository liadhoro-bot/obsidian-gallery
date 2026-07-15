create table if not exists public.campaign_dice_rolls (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  player_key text not null,
  roll_reason text not null,
  reason_key text not null,
  die_one integer not null check (die_one between 1 and 6),
  die_two integer not null check (die_two between 1 and 6),
  total integer not null check (total between 2 and 12),
  ip_address text,
  user_agent text,
  email_sent boolean not null default false,
  email_attempted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_dice_rolls_one_roll_per_reason unique (player_key, reason_key),
  constraint campaign_dice_rolls_total_matches_dice check (total = die_one + die_two)
);

alter table public.campaign_dice_rolls enable row level security;

create index if not exists campaign_dice_rolls_created_at_idx
on public.campaign_dice_rolls (created_at desc);
