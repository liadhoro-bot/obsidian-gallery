-- Guide cards: does this card become a step in a unit's Workflow checklist?
-- Set by the creator with the "Workflow step" switch in the card editor.
-- null = default for the card type (paint lists off, every other card on);
-- covers and index cards are not recipe_steps and never become steps.
alter table public.recipe_steps
  add column if not exists workflow_step boolean;
