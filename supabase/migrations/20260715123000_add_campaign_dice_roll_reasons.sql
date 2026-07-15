alter table public.campaign_dice_rolls
add column if not exists roll_reason text;

alter table public.campaign_dice_rolls
add column if not exists reason_key text;

update public.campaign_dice_rolls
set
  roll_reason = coalesce(nullif(roll_reason, ''), 'Unspecified roll'),
  reason_key = coalesce(nullif(reason_key, ''), 'unspecified roll')
where roll_reason is null
  or roll_reason = ''
  or reason_key is null
  or reason_key = '';

alter table public.campaign_dice_rolls
alter column roll_reason set not null;

alter table public.campaign_dice_rolls
alter column reason_key set not null;

alter table public.campaign_dice_rolls
drop constraint if exists campaign_dice_rolls_one_roll_per_player;

create unique index if not exists campaign_dice_rolls_one_roll_per_reason_idx
on public.campaign_dice_rolls (player_key, reason_key);
