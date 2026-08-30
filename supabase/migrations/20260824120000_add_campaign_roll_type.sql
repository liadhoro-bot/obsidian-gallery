alter table public.campaign_dice_rolls
add column if not exists roll_type text not null default '2d6';

update public.campaign_dice_rolls
set roll_type = '2d6'
where roll_type is null
  or roll_type not in ('1d6', '2d6');

alter table public.campaign_dice_rolls
drop constraint if exists campaign_dice_rolls_roll_type_check;

alter table public.campaign_dice_rolls
add constraint campaign_dice_rolls_roll_type_check
check (roll_type in ('1d6', '2d6'));

alter table public.campaign_dice_rolls
alter column die_two drop not null;

alter table public.campaign_dice_rolls
drop constraint if exists campaign_dice_rolls_die_two_check;

alter table public.campaign_dice_rolls
drop constraint if exists campaign_dice_rolls_total_check;

alter table public.campaign_dice_rolls
drop constraint if exists campaign_dice_rolls_total_matches_dice;

alter table public.campaign_dice_rolls
add constraint campaign_dice_rolls_die_two_by_type_check
check (
  (roll_type = '1d6' and die_two is null)
  or (roll_type = '2d6' and die_two between 1 and 6)
);

alter table public.campaign_dice_rolls
add constraint campaign_dice_rolls_total_by_type_check
check (
  (roll_type = '1d6' and total = die_one and total between 1 and 6)
  or (roll_type = '2d6' and total = die_one + die_two and total between 2 and 12)
);

alter table public.campaign_dice_rolls
drop constraint if exists campaign_dice_rolls_one_roll_per_reason;

drop index if exists public.campaign_dice_rolls_one_roll_per_reason_idx;

create unique index if not exists campaign_dice_rolls_one_roll_per_reason_type_idx
on public.campaign_dice_rolls (player_key, reason_key, roll_type);

drop function if exists public.record_campaign_dice_roll(text, text, text, text);
drop function if exists public.record_campaign_dice_roll(text, text, text, text, text);
drop function if exists public.record_campaign_dice_roll(text, text, text, text, text, text);

create function public.record_campaign_dice_roll(
  p_player_name text,
  p_roll_reason text,
  p_roll_type text default '2d6',
  p_app_username text default null,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table (
  roll_id uuid,
  roll_player_name text,
  roll_app_username text,
  roll_reason_text text,
  roll_type_text text,
  roll_die_one integer,
  roll_die_two integer,
  roll_total integer,
  roll_created_at timestamptz,
  duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $record_campaign_dice_roll$
declare
  v_player_name text := regexp_replace(btrim(coalesce(p_player_name, '')), '\s+', ' ', 'g');
  v_roll_reason text := regexp_replace(btrim(coalesce(p_roll_reason, '')), '\s+', ' ', 'g');
  v_roll_type text := lower(btrim(coalesce(p_roll_type, '2d6')));
  v_app_username text := nullif(regexp_replace(btrim(coalesce(p_app_username, '')), '\s+', ' ', 'g'), '');
  v_player_key text := lower(regexp_replace(btrim(coalesce(p_player_name, '')), '\s+', ' ', 'g'));
  v_reason_key text := lower(regexp_replace(btrim(coalesce(p_roll_reason, '')), '\s+', ' ', 'g'));
  v_roll_id uuid;
  v_roll_player_name text;
  v_roll_app_username text;
  v_roll_reason_text text;
  v_roll_type_text text;
  v_roll_die_one integer;
  v_roll_die_two integer;
  v_roll_total integer;
  v_roll_created_at timestamptz;
begin
  if length(v_player_name) < 2 or length(v_player_name) > 80 then
    raise exception 'invalid_player_name';
  end if;

  if length(v_roll_reason) < 3 or length(v_roll_reason) > 160 then
    raise exception 'invalid_roll_reason';
  end if;

  if v_roll_type not in ('1d6', '2d6') then
    raise exception 'invalid_roll_type';
  end if;

  select
    cdr.id,
    cdr.player_name,
    cdr.app_username,
    cdr.roll_reason,
    cdr.roll_type,
    cdr.die_one,
    cdr.die_two,
    cdr.total,
    cdr.created_at
  into
    v_roll_id,
    v_roll_player_name,
    v_roll_app_username,
    v_roll_reason_text,
    v_roll_type_text,
    v_roll_die_one,
    v_roll_die_two,
    v_roll_total,
    v_roll_created_at
  from public.campaign_dice_rolls cdr
  where cdr.player_key = v_player_key
    and cdr.reason_key = v_reason_key
    and cdr.roll_type = v_roll_type
  limit 1;

  if found then
    return query
    select
      v_roll_id,
      v_roll_player_name,
      v_roll_app_username,
      v_roll_reason_text,
      v_roll_type_text,
      v_roll_die_one,
      v_roll_die_two,
      v_roll_total,
      v_roll_created_at,
      true;
    return;
  end if;

  v_roll_die_one := floor(random() * 6)::integer + 1;
  if v_roll_type = '2d6' then
    v_roll_die_two := floor(random() * 6)::integer + 1;
    v_roll_total := v_roll_die_one + v_roll_die_two;
  else
    v_roll_die_two := null;
    v_roll_total := v_roll_die_one;
  end if;

  insert into public.campaign_dice_rolls (
    player_name,
    player_key,
    app_username,
    roll_reason,
    reason_key,
    roll_type,
    die_one,
    die_two,
    total,
    ip_address,
    user_agent
  )
  values (
    v_player_name,
    v_player_key,
    v_app_username,
    v_roll_reason,
    v_reason_key,
    v_roll_type,
    v_roll_die_one,
    v_roll_die_two,
    v_roll_total,
    p_ip_address,
    p_user_agent
  )
  on conflict (player_key, reason_key, roll_type) do nothing
  returning campaign_dice_rolls.id, campaign_dice_rolls.created_at
  into v_roll_id, v_roll_created_at;

  if not found then
    select
      cdr.id,
      cdr.player_name,
      cdr.app_username,
      cdr.roll_reason,
      cdr.roll_type,
      cdr.die_one,
      cdr.die_two,
      cdr.total,
      cdr.created_at
    into
      v_roll_id,
      v_roll_player_name,
      v_roll_app_username,
      v_roll_reason_text,
      v_roll_type_text,
      v_roll_die_one,
      v_roll_die_two,
      v_roll_total,
      v_roll_created_at
    from public.campaign_dice_rolls cdr
    where cdr.player_key = v_player_key
      and cdr.reason_key = v_reason_key
      and cdr.roll_type = v_roll_type
    limit 1;

    return query
    select
      v_roll_id,
      v_roll_player_name,
      v_roll_app_username,
      v_roll_reason_text,
      v_roll_type_text,
      v_roll_die_one,
      v_roll_die_two,
      v_roll_total,
      v_roll_created_at,
      true;
    return;
  end if;

  return query
  select
    v_roll_id,
    v_player_name,
    v_app_username,
    v_roll_reason,
    v_roll_type,
    v_roll_die_one,
    v_roll_die_two,
    v_roll_total,
    v_roll_created_at,
    false;
end;
$record_campaign_dice_roll$;

revoke all on function public.record_campaign_dice_roll(text, text, text, text, text, text) from public;
grant execute on function public.record_campaign_dice_roll(text, text, text, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
