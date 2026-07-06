create policy "Authenticated users can insert contest audit events"
on public.contest_audit_events
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and public.contest_is_visible_to_user(contest_id)
);
