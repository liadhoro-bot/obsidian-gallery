# News ingestion setup

The Hobby News Engine collects announcements into the Newsroom inbox
(`/community/newsroom/inbox`). Nothing collected is published automatically:
each morning an editor opens **Today**, picks 1–3 stories, starts a draft,
writes two sentences in their own words and publishes.

## Sources

| Kind | What we keep | What can appear on an article |
|---|---|---|
| Official site feeds and sitemaps (The Army Painter, Mantic) | Headline, link, date, their short description (private to editors) | Our own words and a link |
| Official YouTube channels (Warhammer, The Army Painter, Mantic, Monument, Wargames Atlantic) | Video id, title, description, YouTube thumbnail | Our own words, a link, and the video through YouTube's embedded player |
| Tip-off blogs (Bell of Lost Souls, Spikey Bits, OnTableTop) | Headline, link and date only (`public_feed` + `link_only`) | Our own words and a link |

Never copy text or images from any source. A picture on an article is either
our own or licensed image, the official YouTube video, or the category artwork.

YouTube data is refreshed on every run; anything not seen for 30 days is
deleted (or reduced to its video id if a draft was started from it), as
YouTube's API policies require.

## How it runs

1. A Supabase Cron job calls `POST /api/news/ingest` every 15 minutes with a
   shared secret.
2. The route collects only from sources that are enabled and due
   (`poll_interval_minutes`, doubled after each consecutive failure, up to 16x).
   YouTube sources are skipped until `YOUTUBE_API_KEY` is set.
3. Each source runs on its own: a failure is recorded on that source
   (`last_error`, `consecutive_failures`) and in `news_ingestion_runs`, and
   the other sources carry on.
4. A second job calls `POST /api/news/digest` each morning, which sends the
   editors (`ADMIN_USER_IDS`) a push notification with today's story count.
5. Admins can also press **Collect now** on `/community/newsroom/sources`.

## Configuration

| Where | Name | Value |
|---|---|---|
| Vercel (Production) | `NEWS_INGEST_SECRET` | 64 hex characters; must match the Vault secret |
| Vercel (Production) | `YOUTUBE_API_KEY` | A YouTube Data API v3 key, restricted to that API |
| Supabase Vault | `news_ingest_secret` | Same value as `NEWS_INGEST_SECRET` |

The routes reject requests when the secret is missing or shorter than 32
characters. Five channels checked every 3–6 hours use about 30 of YouTube's
10,000 free daily quota units.

## Scheduler SQL

Run once in the Supabase SQL editor, replacing the placeholder with the real
secret. Never commit the secret.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret('<NEWS_INGEST_SECRET>', 'news_ingest_secret');

select cron.schedule(
  'news-ingest',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://obsidian-gallery-v3.vercel.app/api/news/ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'news_ingest_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- 07:00 UTC every day.
select cron.schedule(
  'news-digest',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://obsidian-gallery-v3.vercel.app/api/news/digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'news_ingest_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

To pause: `select cron.unschedule('news-ingest');` and
`select cron.unschedule('news-digest');`, or turn sources off on the Sources page.

## Official videos and covers

After collecting, each run checks up to 3 new stories (from the last 30 hours,
with at least one "Likely news" report and no video yet) for an official video.
`lib/news/game-systems.ts` works out the game from the headline, which picks
the maker's channel; `search.list` on that channel only (100 quota units), and
a result is kept only when its title shares distinctive words with the story.
A match is stored under that channel's YouTube source in the same story, so the
Today card, Start draft and the article all get the video. Each story is
checked once (`news_story_clusters.video_searched_at`), at most 60 a day.

Articles with no image or video get a cover drawn in CSS (`news-cover.tsx`):
the game, its maker and a colour per game. No outside image is used.

## Adding or enabling a source

A source can only be turned on once `collection_permission` is
`terms_allow` or `written_permission`, or `public_feed` with
`content_reuse = 'link_only'` (a database check enforces this). Record what
was checked, and when, in `permission_notes`. Before enabling:

- Check `robots.txt` and the site's terms for crawling and reuse.
- Confirm the feed, sitemap or listing actually returns recent posts.
- Requests stay on the source's own domain over HTTPS, identify as
  `ObsidianGalleryNewsBot`, honour `robots.txt`, and wait `rate_limit_ms`
  between requests. YouTube sources use the official API instead of crawling.
