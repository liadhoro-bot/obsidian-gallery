-- Community > News, Phase 2: collecting announcements from approved sources.
-- Everything here is admin-only. The app reads and writes these tables with
-- the service role after its ADMIN_USER_IDS check, so RLS is on with no
-- policies. Collected material is evidence for editors, never public content:
-- readers only ever see news_articles.

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  -- Stable key used in code and logs.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  -- Requests may only go to this host or its www. form.
  domain text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  coverage text,
  -- Prefills drafts started from this source's items.
  default_category text not null default 'miniatures'
    check (default_category in ('paints', 'miniatures', 'tools', 'events')),
  manufacturer text,
  discovery_method text not null
    check (discovery_method in ('feed', 'sitemap', 'html_listing', 'release_page')),
  listing_url text not null check (listing_url ~ '^https://'),
  -- Sitemap sources: which child sitemaps and which page URLs count as news.
  sitemap_child_pattern text,
  url_include_pattern text,
  enabled boolean not null default false,
  poll_interval_minutes integer not null default 180 check (poll_interval_minutes >= 15),
  -- Pause between requests to the same source within one run.
  rate_limit_ms integer not null default 2000 check (rate_limit_ms >= 500),
  max_items_per_run integer not null default 20 check (max_items_per_run between 1 and 100),
  -- Items older than this are ignored, so a first run doesn't import an archive.
  lookback_days integer not null default 21 check (lookback_days between 1 and 365),
  -- What we're allowed to do. A source can only be enabled once collection is allowed.
  collection_permission text not null default 'unverified'
    check (collection_permission in ('unverified', 'terms_allow', 'written_permission', 'denied')),
  publication_eligibility text not null default 'manual_only'
    check (publication_eligibility in ('manual_only', 'auto_eligible')),
  content_reuse text not null default 'link_and_summary'
    check (content_reuse in ('link_and_summary', 'link_only')),
  image_reuse text not null default 'none'
    check (image_reuse in ('none', 'with_permission', 'licensed')),
  permission_notes text,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0,
  failure_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint news_sources_enabled_needs_permission check (
    not enabled or collection_permission in ('terms_allow', 'written_permission')
  )
);

create table if not exists public.news_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources (id) on delete cascade,
  trigger text not null check (trigger in ('schedule', 'manual')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_seen integer not null default 0,
  items_new integer not null default 0,
  items_duplicate integer not null default 0,
  items_skipped integer not null default 0,
  error text
);

create index if not exists news_ingestion_runs_source_idx
  on public.news_ingestion_runs (source_id, started_at desc);

-- One underlying event, possibly reported by several sources.
create table if not exists public.news_story_clusters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Sorted significant title words; the deterministic match key.
  title_key text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  item_count integer not null default 0
);

create index if not exists news_story_clusters_recent_idx
  on public.news_story_clusters (last_seen_at desc);

create table if not exists public.news_source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources (id) on delete cascade,
  -- Feed guid or the page URL; stable per source.
  external_id text not null,
  canonical_url text not null check (canonical_url ~ '^https://'),
  title text not null check (char_length(title) between 1 and 300),
  published_at timestamptz,
  -- Short, untrusted text from the source. Shown to editors as plain text only.
  evidence_excerpt text check (evidence_excerpt is null or char_length(evidence_excerpt) <= 500),
  -- sha256 of normalized title and date; catches the same post under another URL.
  content_fingerprint text not null,
  relevance text not null check (relevance in ('relevant', 'maybe', 'irrelevant')),
  relevance_reasons text[] not null default '{}',
  state text not null default 'new' check (state in ('new', 'dismissed', 'drafted')),
  cluster_id uuid references public.news_story_clusters (id) on delete set null,
  first_run_id uuid references public.news_ingestion_runs (id) on delete set null,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint news_source_items_external_unique unique (source_id, external_id),
  constraint news_source_items_url_unique unique (canonical_url),
  constraint news_source_items_fingerprint_unique unique (source_id, content_fingerprint)
);

create index if not exists news_source_items_inbox_idx
  on public.news_source_items (state, relevance, discovered_at desc);

create index if not exists news_source_items_cluster_idx
  on public.news_source_items (cluster_id);

-- Which collected items an article was written from. Separate from the
-- reader-facing attribution on news_articles.
create table if not exists public.news_article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles (id) on delete cascade,
  source_item_id uuid not null references public.news_source_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint news_article_sources_unique unique (article_id, source_item_id)
);

create index if not exists news_article_sources_item_idx
  on public.news_article_sources (source_item_id);

-- Audit trail of editorial and operational decisions.
create table if not exists public.news_editorial_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'item_dismissed', 'item_restored', 'draft_started',
    'source_enabled', 'source_disabled', 'run_requested'
  )),
  actor_id uuid references auth.users (id) on delete set null,
  source_id uuid references public.news_sources (id) on delete set null,
  source_item_id uuid references public.news_source_items (id) on delete set null,
  article_id uuid references public.news_articles (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists news_editorial_events_recent_idx
  on public.news_editorial_events (created_at desc);

alter table public.news_sources enable row level security;
alter table public.news_ingestion_runs enable row level security;
alter table public.news_story_clusters enable row level security;
alter table public.news_source_items enable row level security;
alter table public.news_article_sources enable row level security;
alter table public.news_editorial_events enable row level security;

revoke all on public.news_sources from anon, authenticated;
revoke all on public.news_ingestion_runs from anon, authenticated;
revoke all on public.news_story_clusters from anon, authenticated;
revoke all on public.news_source_items from anon, authenticated;
revoke all on public.news_article_sources from anon, authenticated;
revoke all on public.news_editorial_events from anon, authenticated;

-- The source registry from the spec. Only sources whose terms we've checked
-- start enabled; the rest wait for permission (see permission_notes).
insert into public.news_sources (
  slug, name, domain, coverage, default_category, manufacturer, discovery_method,
  listing_url, sitemap_child_pattern, url_include_pattern, enabled, poll_interval_minutes,
  collection_permission, permission_notes
) values
  ('the-army-painter', 'The Army Painter', 'thearmypainter.com', 'Paint ranges and tools',
   'paints', 'The Army Painter', 'feed', 'https://thearmypainter.com/blogs/explore.atom',
   null, null, true, 180, 'terms_allow',
   'Checked 2026-11-11: public Atom feed; terms of service have no crawling or reuse restriction.'),
  ('mantic-games', 'Mantic Games', 'manticgames.com', 'Miniature releases',
   'miniatures', 'Mantic Games', 'sitemap', 'https://www.manticgames.com/sitemap_index.xml',
   'post-sitemap', '/news/', true, 240, 'terms_allow',
   'Checked 2026-11-11: robots.txt allows all. Terms allow non-commercial copying only, so discovery only: headline, date and link, with our own summary.'),
  ('monument-hobbies', 'Monument Hobbies', 'monumenthobbies.com', 'PRO Acryl and tools',
   'paints', 'Monument Hobbies', 'feed', 'https://monumenthobbies.com/blogs/news.atom',
   null, null, false, 180, 'unverified',
   'Atom feed works, but the terms forbid spidering, crawling or scraping. Ask for written permission.'),
  ('wargames-atlantic', 'Wargames Atlantic', 'wargamesatlantic.com', 'New miniature kits',
   'miniatures', 'Wargames Atlantic', 'feed', 'https://wargamesatlantic.com/blogs/news.atom',
   null, null, false, 240, 'unverified',
   'Atom feed works, but the terms forbid spidering, crawling or scraping. Ask for written permission.'),
  ('warhammer-community', 'Warhammer Community', 'warhammer-community.com', 'GW, Citadel, 40K, AoS, Old World',
   'miniatures', 'Games Workshop', 'sitemap', 'https://www.warhammer-community.com/sitemap.xml',
   null, '/en-gb/articles/', false, 120, 'unverified',
   'No feed. robots.txt blocks AI crawlers; terms ban AI training and allow links only for personal non-commercial use. Ask Games Workshop.'),
  ('vallejo', 'Vallejo', 'acrylicosvallejo.com', 'Paint ranges and products',
   'paints', 'Vallejo', 'html_listing', 'https://acrylicosvallejo.com/en/model-blog/',
   null, null, false, 720, 'unverified',
   'English feed is stale (2022). robots.txt asks for long crawl delays. Needs a page extractor and a terms check.'),
  ('warlord-games', 'Warlord Games', 'warlordgames.com', 'Miniatures and historical wargaming',
   'miniatures', 'Warlord Games', 'feed', 'https://store.warlordgames.com/blogs/news.atom',
   null, null, false, 240, 'unverified',
   'Old feed stops in 2021 and the store news feed is empty. Find the current news page first.')
on conflict (slug) do nothing;
