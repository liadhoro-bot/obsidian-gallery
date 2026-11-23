-- Community > News: daily digest sources.
--
-- 1. Official YouTube channels, read through the YouTube Data API. Their videos
--    can be shown on articles through YouTube's own embedded player, which
--    gives a story a picture without copying anyone's images.
-- 2. News blogs as tip-offs ("public_feed"): only the headline, link and date
--    are kept, never their text or images. Editors write their own summary.

alter table public.news_sources
  drop constraint if exists news_sources_discovery_method_check,
  add constraint news_sources_discovery_method_check
    check (discovery_method in ('feed', 'sitemap', 'html_listing', 'release_page', 'youtube'));

alter table public.news_sources
  add column if not exists youtube_channel_id text
    check (youtube_channel_id is null or youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$');

alter table public.news_sources
  drop constraint if exists news_sources_youtube_needs_channel,
  add constraint news_sources_youtube_needs_channel
    check (discovery_method <> 'youtube' or youtube_channel_id is not null);

-- public_feed: a feed the site publishes for readers. We take headlines and
-- links only, so such a source must also be link_only.
alter table public.news_sources
  drop constraint if exists news_sources_collection_permission_check,
  add constraint news_sources_collection_permission_check
    check (collection_permission in ('unverified', 'terms_allow', 'written_permission', 'public_feed', 'denied'));

alter table public.news_sources
  drop constraint if exists news_sources_enabled_needs_permission,
  add constraint news_sources_enabled_needs_permission check (
    not enabled
    or collection_permission in ('terms_allow', 'written_permission')
    or (collection_permission = 'public_feed' and content_reuse = 'link_only')
  );

-- Only YouTube's own thumbnails are kept: they go with an embeddable video.
alter table public.news_source_items
  add column if not exists video_id text
    check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
  add column if not exists thumbnail_url text
    check (thumbnail_url is null or thumbnail_url ~ '^https://i\.ytimg\.com/');

-- An article can show an official YouTube video in place of a photo.
alter table public.news_articles
  add column if not exists video_id text
    check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$');

insert into public.news_sources (
  slug, name, domain, coverage, default_category, manufacturer, discovery_method, listing_url,
  youtube_channel_id, enabled, poll_interval_minutes, rate_limit_ms, max_items_per_run, lookback_days,
  collection_permission, content_reuse, image_reuse, permission_notes
) values
  ('warhammer-youtube', 'Warhammer (YouTube)', 'youtube.com', 'GW reveals and trailers', 'miniatures', 'Games Workshop',
    'youtube', 'https://www.youtube.com/@officialwarhammer', 'UCm4UYMFMVFKtZBi9uk4HSCg', true, 180, 1000, 15, 7,
    'terms_allow', 'link_and_summary', 'licensed',
    'Checked 2026-11-19: official channel linked from warhammer-community.com. Read through the YouTube Data API; videos shown only through YouTube''s embedded player. API data older than 30 days is deleted or cleared.'),
  ('the-army-painter-youtube', 'The Army Painter (YouTube)', 'youtube.com', 'Paint and tool videos', 'paints', 'The Army Painter',
    'youtube', 'https://www.youtube.com/@TheArmyPainter', 'UCMVBDCPwjvNITHKwimep87g', true, 360, 1000, 15, 7,
    'terms_allow', 'link_and_summary', 'licensed',
    'Checked 2026-11-19: official channel. YouTube Data API and embedded player only.'),
  ('mantic-games-youtube', 'Mantic Games (YouTube)', 'youtube.com', 'Game and miniature trailers', 'miniatures', 'Mantic Games',
    'youtube', 'https://www.youtube.com/@ManticGames', 'UC1kZj3a75YlHhiHR7pLykFg', true, 360, 1000, 15, 7,
    'terms_allow', 'link_and_summary', 'licensed',
    'Checked 2026-11-19: official channel. YouTube Data API and embedded player only.'),
  ('monument-hobbies-youtube', 'Monument Hobbies (YouTube)', 'youtube.com', 'PRO Acryl and tools', 'paints', 'Monument Hobbies',
    'youtube', 'https://www.youtube.com/@MonumentHobbies', 'UCKkhdUiappmwm6Yd5Ea3GEg', true, 360, 1000, 15, 7,
    'terms_allow', 'link_and_summary', 'licensed',
    'Checked 2026-11-19: official channel. Their website terms forbid crawling, so only YouTube is used.'),
  ('wargames-atlantic-youtube', 'Wargames Atlantic (YouTube)', 'youtube.com', 'New miniature kits', 'miniatures', 'Wargames Atlantic',
    'youtube', 'https://www.youtube.com/@WargamesAtlantic', 'UCM_Bai5-KCQFzB7IMhK9Z8A', true, 360, 1000, 15, 7,
    'terms_allow', 'link_and_summary', 'licensed',
    'Checked 2026-11-19: official channel. Their website terms forbid crawling, so only YouTube is used.'),
  ('bell-of-lost-souls', 'Bell of Lost Souls', 'belloflostsouls.net', 'Tip-offs: GW and wider tabletop news', 'miniatures', null,
    'feed', 'https://www.belloflostsouls.net/feed', null, true, 180, 2000, 20, 3,
    'public_feed', 'link_only', 'none',
    'Checked 2026-11-19: robots.txt allows the feed. Terms reserve all rights and bar copying, so headline, date and link only; never their text or images.'),
  ('spikey-bits', 'Spikey Bits', 'spikeybits.com', 'Tip-offs: GW pre-orders and releases', 'miniatures', null,
    'feed', 'https://spikeybits.com/feed/', null, true, 180, 2000, 20, 3,
    'public_feed', 'link_only', 'none',
    'Checked 2026-11-19: robots.txt allows the feed; terms page is behind a bot check, so treated as all rights reserved. Headline, date and link only.'),
  ('ontabletop', 'OnTableTop', 'ontabletop.com', 'Tip-offs: smaller makers and Kickstarters', 'miniatures', null,
    'feed', 'https://www.ontabletop.com/feed/', null, true, 240, 2000, 20, 3,
    'public_feed', 'link_only', 'none',
    'Checked 2026-11-19: robots.txt allows the feed; no published terms, so all rights reserved. Headline, date and link only.')
on conflict (slug) do nothing;
