alter table public.onboarding_flow_actions
  drop constraint if exists onboarding_flow_actions_order_check;

alter table public.onboarding_flow_actions
  add column if not exists milestone_key text,
  add column if not exists milestone_label text,
  add column if not exists milestone_order integer;

alter table public.user_onboarding_flows
  add column if not exists subject_unit_id uuid;

alter table public.user_onboarding_flows
  add column if not exists subject_project_id uuid;

alter table public.user_onboarding_flows
  add column if not exists subject_guide_id uuid;

alter table public.user_onboarding_flows
  add column if not exists subject_session_id uuid;

create unique index if not exists onboarding_flow_actions_flow_key_unique
  on public.onboarding_flow_actions (flow_name, action_key);

create unique index if not exists onboarding_flow_actions_flow_order_unique
  on public.onboarding_flow_actions (flow_name, action_order);

update public.onboarding_flow_actions
set action_key = case action_key
    when 'add_or_photograph_miniature' then 'create_unit'
    when 'choose_beginner_guide' then 'choose_unit_guide'
    when 'complete_first_painting_step' then 'set_unit_progress_stage'
    when 'create_first_project' then 'create_project'
    when 'add_unit_to_bench' then 'add_unit_to_active_bench'
    when 'mark_owned_paints' then 'add_owned_paints'
    when 'create_custom_guide' then 'create_guide'
    when 'add_showcase_photos' then 'add_guide_cover'
    when 'share_completed_unit' then 'finish_first_guide'
    else action_key
  end,
  action_order = action_order + 1000
where flow_name in ('paint_miniature', 'organize_hobby', 'create_content');

insert into public.onboarding_action_flows
  (name, title, persona_label, description)
values
  (
    'paint_miniature',
    'Paint My Next Miniature',
    'Painter',
    'Set up a miniature, prepare a painting plan, paint it using Obsidian Gallery, and leave your next session ready to resume.'
  ),
  (
    'organize_hobby',
    'Sort Out My Hobby',
    'Hobby Organizer',
    'Organize current projects, active miniatures and paints, then establish a repeatable Painting Table workflow.'
  ),
  (
    'create_content',
    'Write a Guide',
    'Guide Creator',
    'Turn painting knowledge into structured Cards and Decks, preview the experience, and complete your first Guide.'
  )
on conflict (name) do update
set
  title = excluded.title,
  persona_label = excluded.persona_label,
  description = excluded.description;

insert into public.onboarding_flow_actions
  (
    flow_name,
    action_key,
    action_label,
    action_order,
    breadcrumb,
    ref_page,
    ref_component,
    milestone_key,
    milestone_label,
    milestone_order
  )
values
  ('paint_miniature', 'create_unit', 'Create a Unit', 1, 'Units -> + New Unit', 'units', 'create_unit', 'setup_miniature', 'Set up your miniature', 1),
  ('paint_miniature', 'name_unit', 'Give your Unit a name', 2, 'Unit Builder -> Info -> Name', 'unit_builder', 'unit_name', 'setup_miniature', 'Set up your miniature', 1),
  ('paint_miniature', 'add_unit_image', 'Add an image of your miniature', 3, 'Unit Builder -> Image -> Upload or choose effigy', 'unit_builder', 'unit_image', 'setup_miniature', 'Set up your miniature', 1),
  ('paint_miniature', 'complete_unit_info', 'Fill in your miniature''s details', 4, 'Unit Builder -> Info -> Details', 'unit_builder', 'unit_info', 'setup_miniature', 'Set up your miniature', 1),
  ('paint_miniature', 'set_unit_progress_stage', 'Tell us where you are in the painting process', 5, 'Unit -> Progress -> Current Stage', 'unit_detail', 'progress_stage', 'setup_miniature', 'Set up your miniature', 1),
  ('paint_miniature', 'choose_unit_guide', 'Choose a Guide to follow', 6, 'Unit -> Guide -> Choose Guide', 'unit_detail', 'guide_picker', 'prepare_to_paint', 'Prepare to paint', 2),
  ('paint_miniature', 'assign_guide_to_unit', 'Add the Guide to your Unit', 7, 'Guide -> Use this Guide -> Select Unit', 'guide_detail', 'assign_guide', 'prepare_to_paint', 'Prepare to paint', 2),
  ('paint_miniature', 'add_unit_paints', 'Add the paints you plan to use', 8, 'Unit -> Colors -> Add Paint', 'unit_detail', 'unit_palette', 'prepare_to_paint', 'Prepare to paint', 2),
  ('paint_miniature', 'mark_paints_owned', 'Mark the paints you already have', 9, 'Paint -> Ownership -> Owned', 'paint_detail', 'paint_ownership', 'prepare_to_paint', 'Prepare to paint', 2),
  ('paint_miniature', 'set_first_session_goal', 'Decide what you''ll paint first', 10, 'Unit -> Sessions -> Session Goal', 'unit_detail', 'session_goal', 'prepare_to_paint', 'Prepare to paint', 2),
  ('paint_miniature', 'start_first_session', 'Start your first painting session', 11, 'Unit -> Session -> Start Session', 'unit_detail', 'session_tracker', 'paint_with_app', 'Paint with the app', 3),
  ('paint_miniature', 'finish_first_session', 'Finish your painting session', 12, 'Active Session -> Finish Session', 'active_session', 'finish_session', 'paint_with_app', 'Paint with the app', 3),
  ('paint_miniature', 'add_session_progress_photo', 'Add a photo of your progress', 13, 'Session Summary -> Progress Photo -> Add Photo', 'session_summary', 'progress_photo', 'leave_handoff', 'Leave a handoff', 4),
  ('paint_miniature', 'record_session_paints', 'Record the paints you used', 14, 'Session Summary -> Paints Used -> Add Paints', 'session_summary', 'session_paints', 'leave_handoff', 'Leave a handoff', 4),
  ('paint_miniature', 'record_session_note', 'Leave yourself a painting note', 15, 'Session Summary -> Notes -> Add Note', 'session_summary', 'session_notes', 'leave_handoff', 'Leave a handoff', 4),
  ('paint_miniature', 'set_next_painting_action', 'Decide what you''ll do next', 16, 'Session Summary -> Next Action -> Save', 'session_summary', 'next_action', 'leave_handoff', 'Leave a handoff', 4),
  ('organize_hobby', 'create_project', 'Create a Project', 1, 'Projects -> + New Project', 'projects', 'create_project', 'map_hobby', 'Map your hobby', 1),
  ('organize_hobby', 'add_project_unit', 'Add something you''re currently painting', 2, 'Project -> Units -> + Add Unit', 'project_detail', 'add_unit', 'map_hobby', 'Map your hobby', 1),
  ('organize_hobby', 'set_unit_status', 'Decide where this Unit belongs', 3, 'Unit -> Overview -> Status', 'unit_detail', 'unit_status', 'map_hobby', 'Map your hobby', 1),
  ('organize_hobby', 'organize_set_progress_stage', 'Mark where you left off', 4, 'Unit -> Progress -> Current Stage', 'unit_detail', 'progress_stage', 'map_hobby', 'Map your hobby', 1),
  ('organize_hobby', 'add_unit_to_active_bench', 'Put a Unit on your Active Bench', 5, 'Unit -> Overview -> Status -> Bench', 'unit_detail', 'unit_status', 'map_hobby', 'Map your hobby', 1),
  ('organize_hobby', 'feature_unit', 'Choose what deserves your attention first', 6, 'Unit -> Overview -> Featured -> On', 'unit_detail', 'featured_toggle', 'map_hobby', 'Map your hobby', 1),
  ('organize_hobby', 'add_owned_paints', 'Add some paints from your collection', 7, 'Vault -> My Collection -> Add Paints', 'vault', 'paint_collection', 'sort_paints', 'Sort your paints', 2),
  ('organize_hobby', 'create_project_palette', 'Build a palette for your Project', 8, 'Project -> Project Palette -> Add Paints', 'project_detail', 'project_palette', 'sort_paints', 'Sort your paints', 2),
  ('organize_hobby', 'use_project_palette', 'Use your Project palette on a Unit', 9, 'Unit -> Colors -> Project Palette -> Use Paint', 'unit_detail', 'unit_palette', 'sort_paints', 'Sort your paints', 2),
  ('organize_hobby', 'organize_set_next_action', 'Decide the next thing you''ll do', 10, 'Featured Unit -> Next Action -> Edit', 'unit_detail', 'next_action', 'establish_hobby_loop', 'Establish your working loop', 3),
  ('organize_hobby', 'start_session_from_dashboard', 'Start a session from your Painting Table', 11, 'Painting Table -> Featured Unit -> Start Session', 'dashboard', 'featured_unit', 'establish_hobby_loop', 'Establish your working loop', 3),
  ('organize_hobby', 'organize_finish_session', 'Finish the painting session', 12, 'Active Session -> Finish Session', 'active_session', 'finish_session', 'establish_hobby_loop', 'Establish your working loop', 3),
  ('organize_hobby', 'update_unit_progress', 'Update your progress', 13, 'Unit -> Progress -> Mark Progress', 'unit_detail', 'progress_stage', 'establish_hobby_loop', 'Establish your working loop', 3),
  ('organize_hobby', 'organize_set_followup_action', 'Leave your next task ready', 14, 'Session Summary -> Next Action -> Save', 'session_summary', 'next_action', 'establish_hobby_loop', 'Establish your working loop', 3),
  ('create_content', 'choose_guide_source', 'Choose how to start your Guide', 1, 'Guides -> + -> Guide Forge -> Choose Source', 'guide_forge', 'source_picker', 'start_guide', 'Start the Guide', 1),
  ('create_content', 'create_guide', 'Create your Guide', 2, 'Guide Forge -> Create Guide', 'guide_forge', 'create_guide', 'start_guide', 'Start the Guide', 1),
  ('create_content', 'name_guide', 'Give your Guide a title', 3, 'Guide Builder -> Info -> Title', 'guide_builder', 'guide_title', 'start_guide', 'Start the Guide', 1),
  ('create_content', 'add_guide_cover', 'Add a cover image', 4, 'Guide Builder -> Cover -> Image', 'guide_builder', 'guide_cover', 'start_guide', 'Start the Guide', 1),
  ('create_content', 'name_first_guide_deck', 'Name your first Deck', 5, 'Guide Builder -> Decks -> First Deck', 'guide_builder', 'deck_builder', 'build_instructions', 'Build the painting instructions', 2),
  ('create_content', 'create_step_card', 'Add your first painting step', 6, 'Guide Builder -> Deck -> + Card -> Step', 'guide_builder', 'step_card', 'build_instructions', 'Build the painting instructions', 2),
  ('create_content', 'add_step_paints', 'Add the paints used in this step', 7, 'Step Card -> Paints -> Add Paint', 'guide_builder', 'card_paints', 'build_instructions', 'Build the painting instructions', 2),
  ('create_content', 'add_step_image', 'Show what this step looks like', 8, 'Step Card -> Image -> Add Image', 'guide_builder', 'card_image', 'build_instructions', 'Build the painting instructions', 2),
  ('create_content', 'add_second_guide_card', 'Add another Card', 9, 'Guide Builder -> Deck -> + Add Card', 'guide_builder', 'card_picker', 'build_instructions', 'Build the painting instructions', 2),
  ('create_content', 'reorder_guide_cards', 'Put your Guide in the right order', 10, 'Guide Builder -> Deck -> Reorder Cards', 'guide_builder', 'card_order', 'build_instructions', 'Build the painting instructions', 2),
  ('create_content', 'preview_guide', 'Preview your Guide as a painter', 11, 'Guide Builder -> Preview', 'guide_builder', 'guide_preview', 'finish_guide', 'Finish the Guide', 3),
  ('create_content', 'set_guide_visibility', 'Choose who can see your Guide', 12, 'Guide -> Publish Settings -> Visibility', 'guide_detail', 'visibility_control', 'finish_guide', 'Finish the Guide', 3),
  ('create_content', 'finish_first_guide', 'Save or publish your Guide', 13, 'Guide -> Publish Settings -> Save / Publish', 'guide_detail', 'publish_control', 'finish_guide', 'Finish the Guide', 3)
on conflict (flow_name, action_key) do update
set
  action_label = excluded.action_label,
  action_order = excluded.action_order,
  breadcrumb = excluded.breadcrumb,
  ref_page = excluded.ref_page,
  ref_component = excluded.ref_component,
  milestone_key = excluded.milestone_key,
  milestone_label = excluded.milestone_label,
  milestone_order = excluded.milestone_order;

delete from public.onboarding_flow_actions
where flow_name = 'paint_miniature'
  and action_key not in (
    'create_unit',
    'name_unit',
    'add_unit_image',
    'complete_unit_info',
    'set_unit_progress_stage',
    'choose_unit_guide',
    'assign_guide_to_unit',
    'add_unit_paints',
    'mark_paints_owned',
    'set_first_session_goal',
    'start_first_session',
    'finish_first_session',
    'add_session_progress_photo',
    'record_session_paints',
    'record_session_note',
    'set_next_painting_action'
  );

delete from public.onboarding_flow_actions
where flow_name = 'organize_hobby'
  and action_key not in (
    'create_project',
    'add_project_unit',
    'set_unit_status',
    'organize_set_progress_stage',
    'add_unit_to_active_bench',
    'feature_unit',
    'add_owned_paints',
    'create_project_palette',
    'use_project_palette',
    'organize_set_next_action',
    'start_session_from_dashboard',
    'organize_finish_session',
    'update_unit_progress',
    'organize_set_followup_action'
  );

delete from public.onboarding_flow_actions
where flow_name = 'create_content'
  and action_key not in (
    'choose_guide_source',
    'create_guide',
    'name_guide',
    'add_guide_cover',
    'name_first_guide_deck',
    'create_step_card',
    'add_step_paints',
    'add_step_image',
    'add_second_guide_card',
    'reorder_guide_cards',
    'preview_guide',
    'set_guide_visibility',
    'finish_first_guide'
  );
