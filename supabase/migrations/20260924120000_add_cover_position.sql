-- Decks always rendered a synthesized cover card (from recipes.name /
-- description / image_url) unconditionally as card #1, with no way to
-- remove it or use another card as the first card. Store where (if
-- anywhere) that synthesized cover belongs in the card sequence: an index
-- among the full cover+steps sequence, or null to omit the cover entirely.
-- Defaulting to 0 keeps every existing deck's current "cover first"
-- behavior unchanged, and new decks keep that same default unless the
-- owner removes or repositions the cover card in the editor.
alter table public.recipes
  add column if not exists cover_position integer not null default 0;
