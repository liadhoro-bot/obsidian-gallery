alter table public.paint_catalog
add column if not exists color_match_enabled boolean not null default true;

alter table public.paint_catalog
add column if not exists color_match_exclude_reason text;

create index if not exists paint_catalog_color_match_hex_approx_idx
on public.paint_catalog (hex_approx)
where is_active = true
  and color_match_enabled = true
  and hex_approx is not null
  and hex_approx ~ '^#[0-9A-Fa-f]{6}$';

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Green Stuff World auxiliary paints & effects'
where brand ilike '%Green Stuff World%'
  and (
    line ilike any (array['%auxiliary%', '%auxiliaries%', '%effect%', '%effects%'])
    or name ilike any (array['%auxiliary%', '%auxiliaries%', '%effect%', '%effects%'])
    or paint_type ilike any (array['%auxiliary%', '%auxiliaries%', '%effect%', '%effects%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Green Stuff World chrome paints'
where brand ilike '%Green Stuff World%'
  and (
    line ilike '%chrome%'
    or name ilike '%chrome%'
    or paint_type ilike '%chrome%'
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Green Stuff World metallic paints'
where brand ilike '%Green Stuff World%'
  and (
    line ilike '%metallic%'
    or name ilike '%metallic%'
    or paint_type ilike '%metallic%'
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Green Stuff World colorshift / colourshift paints'
where brand ilike '%Green Stuff World%'
  and (
    line ilike any (array['%colorshift%', '%colourshift%'])
    or name ilike any (array['%colorshift%', '%colourshift%'])
    or paint_type ilike any (array['%colorshift%', '%colourshift%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Green Stuff World UV resins'
where brand ilike '%Green Stuff World%'
  and (
    line ilike any (array['%uv resin%', '%resin%'])
    or name ilike any (array['%uv resin%', '%resin%'])
    or paint_type ilike any (array['%uv resin%', '%resin%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'P3 Formula / SFG metallics'
where (
    brand ilike any (array['%P3%', '%Privateer Press%', '%SFG%'])
    or line ilike any (array['%P3 Formula%', '%Formula P3%', '%SFG%'])
  )
  and (
    line ilike '%metallic%'
    or name ilike '%metallic%'
    or paint_type ilike '%metallic%'
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Pro Acryl basing textures'
where (
    brand ilike '%Pro Acryl%'
    or line ilike '%Pro Acryl%'
  )
  and (
    line ilike any (array['%basing texture%', '%texture%'])
    or name ilike any (array['%basing texture%', '%texture%'])
    or paint_type ilike any (array['%basing texture%', '%texture%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Pro Acryl metallics'
where (
    brand ilike '%Pro Acryl%'
    or line ilike '%Pro Acryl%'
  )
  and (
    line ilike '%metallic%'
    or name ilike '%metallic%'
    or paint_type ilike '%metallic%'
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Vallejo auxiliaries'
where brand ilike '%Vallejo%'
  and (
    line ilike any (array['%auxiliary%', '%auxiliaries%'])
    or name ilike any (array['%auxiliary%', '%auxiliaries%'])
    or paint_type ilike any (array['%auxiliary%', '%auxiliaries%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Vallejo metallics / Metal Color'
where brand ilike '%Vallejo%'
  and (
    line ilike any (array['%metal color%', '%metallic%'])
    or name ilike any (array['%metal color%', '%metallic%'])
    or paint_type ilike any (array['%metal color%', '%metallic%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Vallejo Special FX / Special Effects'
where brand ilike '%Vallejo%'
  and (
    line ilike any (array['%special fx%', '%special effect%', '%special effects%'])
    or name ilike any (array['%special fx%', '%special effect%', '%special effects%'])
    or paint_type ilike any (array['%special fx%', '%special effect%', '%special effects%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Vallejo Liquid Metal'
where brand ilike '%Vallejo%'
  and (
    line ilike '%liquid metal%'
    or name ilike '%liquid metal%'
    or paint_type ilike '%liquid metal%'
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Vallejo Pigment FX / pigments'
where brand ilike '%Vallejo%'
  and (
    line ilike any (array['%pigment fx%', '%pigment%', '%pigments%'])
    or name ilike any (array['%pigment fx%', '%pigment%', '%pigments%'])
    or paint_type ilike any (array['%pigment fx%', '%pigment%', '%pigments%'])
  );

update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'Warhammer Colour / Citadel Technical'
where brand ilike any (array['%Warhammer%', '%Citadel%'])
  and (
    line ilike '%technical%'
    or name ilike '%technical%'
    or paint_type ilike '%technical%'
  );
