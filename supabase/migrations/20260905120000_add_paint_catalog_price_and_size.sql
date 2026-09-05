alter table public.paint_catalog
add column if not exists price_usd numeric(6, 2);

alter table public.paint_catalog
add column if not exists size_ml numeric(6, 1);

comment on column public.paint_catalog.price_usd is 'List price in USD from the manufacturer storefront at time of import.';
comment on column public.paint_catalog.size_ml is 'Net pot/bottle/can volume in millilitres.';
