create index if not exists unit_sessions_user_unit_started_idx
on public.unit_sessions (user_id, unit_id, started_at desc);

create index if not exists unit_scheduled_sessions_user_unit_status_start_idx
on public.unit_scheduled_sessions (user_id, unit_id, status, scheduled_start_at);
