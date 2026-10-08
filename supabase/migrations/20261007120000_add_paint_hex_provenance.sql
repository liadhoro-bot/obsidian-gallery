-- Provenance for paint_catalog.hex_approx (paint equivalents revival, phase 1).
-- hex_previous keeps the first legacy value so any correction can be rolled back.
alter table public.paint_catalog
add column if not exists hex_source text,
add column if not exists hex_previous text,
add column if not exists hex_checked_at timestamptz;

comment on column public.paint_catalog.hex_source is
  'Where hex_approx came from: legacy, swatch_sample, manufacturer or manual.';

update public.paint_catalog
set hex_source = 'legacy'
where hex_source is null
  and hex_approx is not null;
