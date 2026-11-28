-- "Notify me when this paint is on sale" toggle on the Paints page detail pane.
-- Stored next to is_owned / is_wishlist, so a row may exist with only
-- sale_alert set (rows with both flags false already exist when toggles are
-- turned off, and every reader filters on is_owned / is_wishlist).
-- Nothing sends alerts yet: this records demand for a later sale feed.
-- Existing RLS policies on user_paint_ownership cover the new column.
alter table public.user_paint_ownership
  add column if not exists sale_alert boolean not null default false;

-- "Who wants alerts for paint X" for the future sender; small, since only
-- opted-in rows are indexed.
create index if not exists user_paint_ownership_sale_alert_idx
  on public.user_paint_ownership (paint_catalog_id)
  where sale_alert;
