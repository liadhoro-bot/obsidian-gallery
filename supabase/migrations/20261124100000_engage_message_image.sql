-- Popup photo chosen in /admin/engage. Null means no photo. The four popups
-- keep the photos they had in code.
alter table public.engagement_messages add column if not exists image_path text;

update public.engagement_messages set image_path = v.path
from (values
  ('push_opt_in_popup', '/onboarding/welcome-hero.jpeg'),
  ('push_opt_in_return_popup', '/onboarding/pains/pile-of-shame.jpeg'),
  ('session_next_step_popup', '/onboarding/problem-desk.jpeg'),
  ('saved_guide_assign_popup', '/onboarding/pains/scheme-loss.jpeg')
) as v(key, path)
where engagement_messages.key = v.key and engagement_messages.image_path is null;
