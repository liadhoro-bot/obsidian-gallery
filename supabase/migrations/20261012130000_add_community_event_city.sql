-- Listings show only the city; the event page shows venue, address, and city.
alter table public.community_events
  add column if not exists city text,
  alter column location_name drop not null;

update public.community_events
set city = 'Rehovot',
    address = 'Neve Alon 1',
    location_name = null
where name = 'Warhammer and Other Creatures (Rehovot Meetup)'
  and city is null;

alter table public.community_events
  alter column city set not null;
