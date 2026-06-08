update public.paint_catalog
set
  color_match_enabled = false,
  color_match_exclude_reason = 'P3/SFG metallic line'
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
  color_match_exclude_reason = 'Vallejo auxiliary/metallic/special FX/liquid metal/pigment line'
where brand ilike '%Vallejo%'
  and (
    line ilike any (array['%auxiliary%', '%auxiliaries%', '%metal color%', '%metallic%', '%special fx%', '%special effect%', '%special effects%', '%liquid metal%', '%pigment fx%', '%pigment%', '%pigments%'])
    or name ilike any (array['%auxiliary%', '%auxiliaries%', '%metal color%', '%metallic%', '%special fx%', '%special effect%', '%special effects%', '%liquid metal%', '%pigment fx%', '%pigment%', '%pigments%'])
    or paint_type ilike any (array['%auxiliary%', '%auxiliaries%', '%metal color%', '%metallic%', '%special fx%', '%special effect%', '%special effects%', '%liquid metal%', '%pigment fx%', '%pigment%', '%pigments%'])
  );
