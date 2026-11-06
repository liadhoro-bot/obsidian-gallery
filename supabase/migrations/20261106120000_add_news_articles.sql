-- Community > News: published articles, written by hand in the Newsroom.
-- Later phases add source items, clusters and editorial events in their own
-- tables and link them here; attribution shown to readers stays on the row.

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  -- Public URL. The Newsroom stops changing it once first published.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 96),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retracted')),
  -- 'og_announcement' keeps official OG posts apart from industry news.
  category text not null
    check (category in ('paints', 'miniatures', 'tools', 'events', 'og_announcement')),
  headline text not null check (char_length(headline) between 1 and 120),
  summary text not null default '',
  why_painters_care text,
  manufacturer text,
  source_name text,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  -- When the source announced it, as opposed to when OG published (published_at).
  source_published_at date,
  -- Only ever a file in our own storage, never a hotlinked third-party URL.
  image_url text,
  image_storage_path text,
  image_alt text,
  image_credit text,
  image_rights text
    check (image_rights is null or image_rights in ('og_original', 'licensed', 'permission')),
  -- A future published_at on a published row is a scheduled article.
  published_at timestamptz,
  first_published_at timestamptz,
  retracted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint news_articles_published_complete check (
    status <> 'published' or (
      published_at is not null
      and first_published_at is not null
      and char_length(btrim(summary)) > 0
    )
  ),
  constraint news_articles_published_attribution check (
    status <> 'published'
    or category = 'og_announcement'
    or (source_name is not null and source_url is not null and source_published_at is not null)
  ),
  constraint news_articles_published_image_rights check (
    status <> 'published' or image_url is null or image_rights is not null
  )
);

create index if not exists news_articles_feed_idx
  on public.news_articles (published_at desc, id desc)
  where status = 'published';

create index if not exists news_articles_category_feed_idx
  on public.news_articles (category, published_at desc, id desc)
  where status = 'published';

alter table public.news_articles enable row level security;

-- Anyone, signed in or not, reads articles that are live. Drafts, retracted
-- and not-yet-due scheduled articles stay hidden, so scheduling needs no job.
drop policy if exists "news_articles_public_read" on public.news_articles;
create policy "news_articles_public_read"
on public.news_articles
for select
to anon, authenticated
using (status = 'published' and published_at <= now());

-- Newsroom writes go through the service role after the app's admin check.
-- This policy only applies if profiles.is_admin ever exists.
drop policy if exists "news_articles_admin_all" on public.news_articles;
create policy "news_articles_admin_all"
on public.news_articles
for all
to authenticated
using (public.current_user_is_global_admin())
with check (public.current_user_is_global_admin());

grant select on public.news_articles to anon;
grant select, insert, update, delete on public.news_articles to authenticated;
