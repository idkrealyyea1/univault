-- =====================================================================
-- UniVault — access request contact info
-- Captures who is requesting (name + WhatsApp) so the admin can reach
-- the student to arrange/confirm payment. Email is filled in server-side
-- from the authenticated Supabase user (never trusted from the client).
-- =====================================================================

alter table access_requests add column if not exists requester_name text;
alter table access_requests add column if not exists whatsapp text;
alter table access_requests add column if not exists email text;
