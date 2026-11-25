-- Newsroom: each new story is checked once for an official YouTube video
-- (lib/news/ingest/run.ts, matchOfficialVideos). Null means not checked yet.
alter table public.news_story_clusters
  add column if not exists video_searched_at timestamptz;

create index if not exists news_story_clusters_video_search_idx
  on public.news_story_clusters (first_seen_at desc)
  where video_searched_at is null;
