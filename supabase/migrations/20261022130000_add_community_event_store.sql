-- Which partner store hosts the event (stores-data.ts id, e.g.
-- 'syrolynia-jerusalem'). Store pages list only events they host.
alter table public.community_events
  add column if not exists store_id text;

create index if not exists community_events_store_idx
  on public.community_events (store_id, event_date)
  where store_id is not null;
