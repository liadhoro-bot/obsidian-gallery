update public.contests
set terms_content = jsonb_set(
  terms_content,
  '{sections,2,clauses,0}',
  to_jsonb('3.1  The Contest opens when it is made live in the App on Thursday 17 September 2026 and ends on Saturday 24 October 2026 at 23:59 Israel Time (the Contest Period).'::text),
  false
)
where slug = 'best-painting-guide' and terms_content is not null;

update public.contests
set terms_content = jsonb_set(
  terms_content,
  '{sections,2,clauses,1}',
  to_jsonb('3.2  Eligible guides may be published and added until Thursday 8 October 2026 at 08:00 Israel Time. A creator may include any number of eligible guides before that deadline. After the guide submission deadline, entries are fixed for the Voting Period, subject to moderation and disqualification under these Rules.'::text),
  false
)
where slug = 'best-painting-guide' and terms_content is not null;

update public.contests
set terms_content = jsonb_set(
  terms_content,
  '{sections,2,clauses,2}',
  to_jsonb('3.3  Voting opens on Friday 16 October 2026 at 00:00 Israel Time and closes on Saturday 24 October 2026 at 23:59 Israel Time (the Voting Period). The App''s server records and clock control receipt times, subject to section 14.'::text),
  false
)
where slug = 'best-painting-guide' and terms_content is not null;

update public.contests
set terms_content = jsonb_set(
  terms_content,
  '{sections,8,clauses,0}',
  to_jsonb('9.1  The Organizer will announce the provisional winners after the Voting Period closes and ballot validation is complete. The announcement date will be posted in the App, and winners may be notified through the Contest page, the App, an account contact channel, or a combination of those methods.'::text),
  false
)
where slug = 'best-painting-guide' and terms_content is not null;

update public.contests
set terms_content = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        terms_content,
        '{summaryTable,rows,1,1}',
        to_jsonb('Opens in the App on Thursday 17 September 2026 and closes Saturday 24 October 2026 at 23:59 Israel Time'::text),
        false
      ),
      '{summaryTable,rows,2,1}',
      to_jsonb('Eligible guides may be published and added through Thursday 8 October 2026 at 08:00 Israel Time; there is no guide limit'::text),
      false
    ),
    '{summaryTable,rows,3,1}',
    to_jsonb('Friday 16 October 2026 at 00:00 through Saturday 24 October 2026 at 23:59 Israel Time'::text),
    false
  ),
  '{summaryTable,rows,6,1}',
  to_jsonb('After voting closes and ballot validation is complete; the date will be posted in the App'::text),
  false
)
where slug = 'best-painting-guide' and terms_content is not null;

update public.contests
set
  terms_content = jsonb_set(
    terms_content,
    '{effectiveLine}',
    to_jsonb('Effective 7 October 2026  |  Version dated 7 October 2026'::text),
    false
  ),
  results_target_at = null,
  updated_at = now()
where slug = 'best-painting-guide' and terms_content is not null;
