# News ingestion setup

Phase 2 of the Hobby News Engine collects announcements from approved sources
into the Newsroom inbox (`/community/newsroom/inbox`). Nothing collected is
published automatically.

## How it runs

1. A Supabase Cron job calls `POST /api/news/ingest` every 15 minutes with a
   shared secret.
2. The route collects only from sources that are enabled and due
   (`poll_interval_minutes`, doubled after each consecutive failure, up to 16x).
3. Each source runs on its own: a failure is recorded on that source
   (`last_error`, `consecutive_failures`) and in `news_ingestion_runs`, and
   the other sources carry on.
4. Admins can also press **Collect now** on `/community/newsroom/sources`.

## Configuration

| Where | Name | Value |
|---|---|---|
| Vercel (Production) | `NEWS_INGEST_SECRET` | 64 hex characters; must match the Vault secret |
| Supabase Vault | `news_ingest_secret` | Same value |

The route rejects requests when the secret is missing or shorter than 32
characters.

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
```

To pause collection: `select cron.unschedule('news-ingest');`, or turn
sources off on the Sources page.

## Adding or enabling a source

A source can only be turned on once `collection_permission` is
`terms_allow` or `written_permission` (a database check enforces this).
Record what was checked, and when, in `permission_notes`. Before enabling:

- Check `robots.txt` and the site's terms for crawling and reuse.
- Confirm the feed, sitemap or listing actually returns recent posts.
- Requests stay on the source's own domain over HTTPS, identify as
  `ObsidianGalleryNewsBot`, honour `robots.txt`, and wait `rate_limit_ms`
  between requests.
