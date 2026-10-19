-- Store Spotlights cards now open /community/stores/[id]; log those clicks too.
alter table public.partner_link_clicks
  drop constraint if exists partner_link_clicks_link_kind_check;

alter table public.partner_link_clicks
  add constraint partner_link_clicks_link_kind_check check (link_kind in (
    'event_page',
    'store_page',
    'website',
    'registration',
    'phone',
    'email',
    'social'
  ));
