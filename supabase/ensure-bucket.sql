-- =====================================================================
-- Studora — ensure the private `resource-files` storage bucket exists.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) if the
-- approved-service page shows no files / admin uploads keep failing.
-- (The backend also self-heals this on deploy, but this fixes it now.)
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('resource-files', 'resource-files', false)
on conflict (id) do nothing;
