-- =====================================================================
-- UniVault — "Most bought services" (admin curated)
-- Adds is_featured to services. The Render backend (service role) is the
-- only writer; admins toggle it from the dashboard.
-- =====================================================================

alter table services add column if not exists is_featured boolean default false;