alter table public.recipe_steps
add column if not exists card_template text;

alter table public.recipe_steps
drop constraint if exists recipe_steps_card_template_check;

alter table public.recipe_steps
add constraint recipe_steps_card_template_check
check (
  card_template is null
  or card_template in ('step', 'theme', 'image', 'small-image', 'paints', 'video')
);
