-- =====================================================================
-- UniVault — Row Level Security Policies
-- Run AFTER schema.sql (and seed.sql is fine either order)
-- =====================================================================

alter table universities enable row level security;
alter table fields enable row level security;
alter table profiles enable row level security;
alter table services enable row level security;
alter table resources enable row level security;
alter table access_requests enable row level security;
alter table access_grants enable row level security;
alter table service_applications enable row level security;
alter table push_subscriptions enable row level security;
alter table audit_log enable row level security;

-- ---------------------------------------------------------------
-- Public read: universities, fields, services (the "storefront"),
-- popularity counts
-- ---------------------------------------------------------------
create policy "public read universities" on universities for select using (true);
create policy "public read fields" on fields for select using (true);
create policy "public read services" on services for select using (true);
-- service_popularity granted in seed.sql — a view of already-public data.

-- No public writes to those three — only the Render backend (service role
-- key) can write. Service role bypasses RLS entirely.

-- ---------------------------------------------------------------
-- Profiles: user can read/update only their own row
-- ---------------------------------------------------------------
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------------
-- Service applications: applicant can insert/read only their own.
-- Approve/reject is admin-only (backend, service role).
-- ---------------------------------------------------------------
create policy "insert own application" on service_applications for insert with check (auth.uid() = applicant_id);
create policy "read own application" on service_applications for select using (auth.uid() = applicant_id);

-- ---------------------------------------------------------------
-- Resources: locked down HARD. A user can only see a resource row if
-- they have a matching access_grants row. This is the actual gate.
-- ---------------------------------------------------------------
create policy "resource visible if granted" on resources for select using (
  exists (
    select 1 from access_grants g
    where g.service_id = resources.service_id
      and g.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------
-- Access requests: user can insert their own, and read their own.
-- No update policy for normal users — approving/rejecting only happens
-- via the Render backend using the service role key.
-- ---------------------------------------------------------------
create policy "insert own access request" on access_requests for insert with check (auth.uid() = user_id);
create policy "read own access request" on access_requests for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Access grants: read-only for the owning user. No client-side insert ever.
-- ---------------------------------------------------------------
create policy "read own access grants" on access_grants for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Push subscriptions: user manages only their own
-- ---------------------------------------------------------------
create policy "insert own push sub" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "read own push sub" on push_subscriptions for select using (auth.uid() = user_id);
create policy "delete own push sub" on push_subscriptions for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Audit log: RLS enabled, zero policies granted to anon/authenticated roles.
-- Only the service role (backend) can touch it. Intentional, not an oversight.
-- ---------------------------------------------------------------
-- (no policies — done)

-- =====================================================================
-- Storage: create the private resource bucket (idempotent)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('resource-files', 'resource-files', false)
on conflict (id) do nothing;
