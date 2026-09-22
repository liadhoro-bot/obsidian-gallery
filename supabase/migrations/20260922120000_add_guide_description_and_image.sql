-- Multi-deck guides (created via the Forge "guide" flow) need their own
-- title/description/cover image, independent of any single member deck's.
-- Auto-created single-deck guides leave these null and the app continues to
-- derive display copy/image from the wrapped deck, same as before.
alter table public.guides
  add column if not exists description text,
  add column if not exists image_url text;
