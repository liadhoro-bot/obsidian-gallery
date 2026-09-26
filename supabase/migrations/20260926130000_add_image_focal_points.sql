-- Card and cover images always rendered with CSS object-fit: cover and the
-- browser's default centered object-position, with no way for the deck
-- owner to control which part of a photo stays visible when the card's
-- aspect ratio crops it. Store a focal point (0-100, matching CSS
-- object-position percentages) per image so the deck editor can offer a
-- drag-to-reposition control, like a social profile-photo cropper.
-- Defaulting to 50/50 (dead center) keeps every existing image's current
-- framing unchanged.
alter table public.recipe_steps
  add column if not exists image_focal_x smallint not null default 50,
  add column if not exists image_focal_y smallint not null default 50;

alter table public.recipes
  add column if not exists cover_focal_x smallint not null default 50,
  add column if not exists cover_focal_y smallint not null default 50;
