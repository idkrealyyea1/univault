-- =====================================================================
-- UniVault — Security Hardening V2 (run AFTER schema.sql + rls.sql)
-- Idempotent: safe to run multiple times.
--
-- 1. CHECK constraints pin status columns to their documented enums, so
--    a malicious client can never INSERT a row with status='approved'
--    (only the backend, via the service role key, may approve).
-- 2. RLS insert policies now require status='pending' so a user can only
--    ever create a request/application in the pending state.
-- 3. Storage policy audit: the `resource-files` bucket is PRIVATE and has
--    intentionally ZERO policies. anon/authenticated roles cannot read,
--    list, write or delete objects; only the backend service role can.
--    (Do NOT add policies here — that would weaken the bucket.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- CHECK constraints (safe to re-run: dropped before recreated)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'access_requests_status_check'
  ) then
    alter table access_requests
      add constraint access_requests_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_applications_status_check'
  ) then
    alter table service_applications
      add constraint service_applications_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RLS: users may only INSERT requests/applications that are 'pending'.
-- The backend (service role) is unaffected and still sets the real status.
-- ---------------------------------------------------------------------
drop policy if exists "insert own access request" on access_requests;
create policy "insert own access request" on access_requests
  for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "insert own application" on service_applications;
create policy "insert own application" on service_applications
  for insert
  with check (auth.uid() = applicant_id and status = 'pending');

-- ---------------------------------------------------------------------
-- Storage audit (documentation only — no policy changes):
--   bucket 'resource-files' is private (public = false).
--   No storage.objects policies exist for anon/authenticated, so direct
--   object access is denied by default. Signed URLs are only ever created
--   by the backend after an access_grants check, with a 10-minute expiry.
-- ---------------------------------------------------------------------
