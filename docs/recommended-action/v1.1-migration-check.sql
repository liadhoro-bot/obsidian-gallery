-- Run after 20261102120000_recommended_action_v1_1.sql. Read-only checks.

-- 1. Stage change dating column and trigger
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'unit_progress_steps' and column_name = 'updated_at';
select tgname from pg_trigger where tgname = 'touch_unit_progress_step_updated_at';

-- 2. Activity function exists, is security invoker, and anon can't run it
select proname, prosecdef as security_definer from pg_proc where proname = 'recommended_action_activity';
select has_function_privilege('anon', 'public.recommended_action_activity(uuid, timestamptz)', 'execute') as anon_can_run;

-- 3. Widened checks and new columns
select conname, pg_get_constraintdef(oid) from pg_constraint
where conname in ('recommended_action_events_event_type_check', 'recommended_action_instances_status_check');
select column_name from information_schema.columns
where table_name = 'recommended_action_instances' and column_name in ('dismiss_reason', 'ranking_revision');

-- 4. Traces table with RLS and its two policies
select relname, relrowsecurity from pg_class where relname = 'recommended_action_traces';
select policyname, cmd from pg_policies where tablename = 'recommended_action_traces';

-- 5. New indexes
select indexname from pg_indexes where indexname like 'ra\_%' order by 1;
