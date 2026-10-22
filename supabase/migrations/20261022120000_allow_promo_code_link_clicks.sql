-- Store pages show members-only discount codes; log "Copy code" taps too.
alter table public.partner_link_clicks
  drop constraint if exists partner_link_clicks_link_kind_check;

alter table public.partner_link_clicks
  add constraint partner_link_clicks_link_kind_check check (link_kind in (
    'event_page',
    'store_page',
    'promo_code',
    'website',
    'registration',
    'phone',
    'email',
    'social'
  ));
