-- Warhammer 40,000 factions the 40,000 Paints palette guides already carry,
-- which had been landing under "Other" on Browse Tags.
insert into public.tag_directory (name, category, aliases, sort_order) values
  ('Adepta Sororitas', 'faction', array['Sisters of Battle', 'Sororitas'], 20),
  ('Adeptus Custodes', 'faction', array['Custodes'], 21),
  ('Adeptus Mechanicus', 'faction', array['AdMech', 'Mechanicus'], 22),
  ('Aeldari', 'faction', array['Eldar', 'Craftworld Eldar', 'Craftworlds'], 23),
  ('Astra Militarum', 'faction', array['Imperial Guard'], 24),
  ('Chaos Daemons', 'faction', array['Daemons'], 25),
  ('Chaos Knights', 'faction', '{}', 26),
  ('Chaos Space Marines', 'faction', array['CSM', 'Heretic Astartes'], 27),
  ('Death Guard', 'faction', '{}', 28),
  ('Drukhari', 'faction', array['Dark Eldar'], 29),
  ('Emperor''s Children', 'faction', array['Emperors Children'], 30),
  ('Genestealer Cults', 'faction', array['Genestealer Cult', 'GSC'], 31),
  ('Grey Knights', 'faction', '{}', 32),
  ('Imperial Knights', 'faction', array['Questor Imperialis'], 33),
  ('Leagues of Votann', 'faction', array['Votann', 'Squats'], 34),
  ('T''au Empire', 'faction', array['Tau', 'T''au', 'Tau Empire'], 35),
  ('Thousand Sons', 'faction', '{}', 36),
  ('World Eaters', 'faction', '{}', 37)
on conflict (lower(name)) do update
  set category = excluded.category, aliases = excluded.aliases, sort_order = excluded.sort_order;

-- Named characters were folded into "Characters" on their guides
-- (2026-10-22); keep a rebuilt database in step.
delete from public.tag_directory where name in (
  'Baron Zemo', 'Black Widow', 'Captain America', 'Captain Marvel', 'Crossbones',
  'Doctor Octopus', 'Iron Man', 'Red Skull', 'Spider-Man', 'Ultron', 'Winter Soldier'
);
