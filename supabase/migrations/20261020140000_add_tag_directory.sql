-- The tag directory: one row per canonical guide tag, with the spellings that
-- should fold into it (aliases) and the Browse Tags section it belongs to.
--
-- guides.tags keeps storing plain text. The app maps any tag that matches a
-- name or alias (case-insensitively) to the row's name, both when a guide is
-- saved and when Discover filters. category is null for tags we keep but
-- haven't sorted yet; Discover lists those under "Other".
--
-- Readable by everyone; edited with the service role only.

create table if not exists public.tag_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 32 and name = btrim(name)),
  category text check (category in ('game', 'faction', 'subject', 'skill', 'technique', 'brand')),
  aliases text[] not null default '{}'::text[],
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists tag_directory_name_lower_idx
  on public.tag_directory (lower(name));

alter table public.tag_directory enable row level security;

drop policy if exists "tag_directory_read_all" on public.tag_directory;
create policy "tag_directory_read_all"
on public.tag_directory
for select
to anon, authenticated
using (true);

grant select on public.tag_directory to anon, authenticated;

insert into public.tag_directory (name, category, aliases, sort_order) values
  -- Games & Worlds.
  ('Warhammer 40,000', 'game', array['Warhammer 40K', '40K', '40,000', '40000', 'WH40K', 'W40K', 'Warhammer40K', 'Warhammer 40000'], 10),
  ('Warhammer Old World', 'game', array['Warhammer: The Old World', 'The Old World', 'Old World', 'TOW'], 11),
  ('Age of Sigmar', 'game', array['Warhammer Age of Sigmar', 'AoS', 'AOS'], 12),
  ('StarCraft', 'game', array['StarCraft II', 'SC2'], 13),
  ('Marvel Crisis Protocol', 'game', array['MCP', 'Crisis Protocol'], 14),
  ('Warcrow', 'game', '{}', 15),

  -- Factions: armies and races within a game.
  ('Space Marines', 'faction', array['Space Marine', 'Adeptus Astartes'], 10),
  ('Tyranids', 'faction', array['Tyranid', 'Nids'], 11),
  ('Orks', 'faction', array['Ork', 'Orcs'], 12),
  ('Necrons', 'faction', array['Necron'], 13),
  ('Tomb Kings', 'faction', '{}', 14),
  ('Terran', 'faction', array['Terrans'], 15),
  ('Protoss', 'faction', '{}', 16),
  ('Zerg', 'faction', '{}', 17),
  ('Dominion', 'faction', '{}', 18),

  -- Subjects: what's being painted.
  ('Basing', 'subject', array['Bases', 'Base'], 10),
  ('Vehicles', 'subject', array['Vehicle', 'Tanks'], 11),
  ('Terrain', 'subject', '{}', 12),
  ('Characters', 'subject', array['Character', 'Heroes'], 13),
  ('Monsters', 'subject', array['Monster'], 14),
  ('Scenery', 'subject', '{}', 15),
  ('Buildings', 'subject', array['Building'], 16),
  ('Captain America', 'subject', '{}', 30),
  ('Captain Marvel', 'subject', '{}', 30),
  ('Iron Man', 'subject', array['Ironman'], 30),
  ('Spider-Man', 'subject', array['Spiderman', 'Spider Man'], 30),
  ('Black Widow', 'subject', '{}', 30),
  ('Winter Soldier', 'subject', '{}', 30),
  ('Red Skull', 'subject', '{}', 30),
  ('Baron Zemo', 'subject', array['Zemo'], 30),
  ('Crossbones', 'subject', '{}', 30),
  ('Doctor Octopus', 'subject', array['Doc Ock', 'Dr Octopus'], 30),
  ('Ultron', 'subject', '{}', 30),

  -- Skill Level: matches guides.difficulty as well as tags.
  ('Beginner', 'skill', array['Beginners', 'Easy', 'Novice'], 10),
  ('Intermediate', 'skill', '{}', 11),
  ('Advanced', 'skill', array['Expert'], 12),

  -- Techniques.
  ('Clean', 'technique', '{}', 10),
  ('Battle-worn', 'technique', array['Battle worn', 'Battleworn', 'Weathering', 'Weathered'], 11),
  ('NMM', 'technique', array['Non-Metallic Metal', 'Non Metallic Metal'], 12),
  ('Lava', 'technique', '{}', 13),
  ('Object Source Lighting', 'technique', array['OSL'], 14),
  ('Comic Style', 'technique', array['Comic', 'Cartoon'], 15),
  ('Gold', 'technique', '{}', 16),
  ('Airbrush', 'technique', array['Airbrushing'], 17),
  ('Drybrushing', 'technique', array['Drybrush', 'Dry brushing', 'Dry brush'], 18),
  ('Glazing', 'technique', array['Glazes'], 19),
  ('Edge Highlighting', 'technique', array['Edge highlights'], 20),

  -- Paint Brands.
  ('Vallejo', 'brand', '{}', 10),
  ('Citadel', 'brand', array['Citadel Colour', 'Games Workshop'], 11),
  ('Army Painter', 'brand', array['The Army Painter'], 12),
  ('Xpress Color', 'brand', array['Vallejo Xpress Color', 'Xpress Colour'], 13),
  ('ProAcryl', 'brand', array['Pro Acryl', 'Monument Hobbies'], 14),
  ('AK Interactive', 'brand', array['AK'], 15),
  ('Scale75', 'brand', array['Scale 75'], 16),

  -- Kept, not yet sorted into a section.
  ('Core Set', null, '{}', 100),
  ('Full Guide', null, '{}', 100)
on conflict (lower(name)) do nothing;
