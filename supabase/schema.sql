-- =====================================================================
-- UniVault — Database Schema (Supabase Postgres)
-- Run this in the Supabase SQL editor BEFORE rls.sql and seed.sql
-- =====================================================================

-- Extension for UUIDs
create extension if not exists "uuid-ossp";

-- 1. Universities
create table universities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  type text not null,           -- e.g. "Public University", "Private University"
  description text,
  logo_url text,
  created_at timestamptz default now()
);

-- 2. Fields (majors) — belong to a university
create table fields (
  id uuid primary key default uuid_generate_v4(),
  university_id uuid references universities(id) on delete cascade,
  name text not null,
  slug text not null,
  theme text not null default 'default',   -- 'default' | 'cyber'
  description text,
  created_at timestamptz default now(),
  unique (university_id, slug)
);

-- 3. Profiles — extends Supabase auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  university_id uuid references universities(id),
  field_id uuid references fields(id),
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 4. Services — the paid offerings (homework help, project help, etc.)
create table services (
  id uuid primary key default uuid_generate_v4(),
  field_id uuid references fields(id) on delete cascade,
  owner_id uuid references profiles(id),   -- null = offered by you directly. Set = a student/provider whose application was approved
  title text not null,
  description text,
  price numeric(10,2) not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 5. Resource files — the actual gated content per service
create table resources (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid references services(id) on delete cascade,
  title text not null,
  storage_path text,     -- path inside the private Supabase Storage bucket
  external_link text,    -- optional, if the resource is just a link
  file_type text,        -- optional mime/extension hint for the UI
  created_at timestamptz default now()
);

-- 6. Access requests — student says "I want this, I'm paying"
create table access_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  status text not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
  payment_note text,       -- e.g. "sent via bank transfer, ref #123"
  requested_at timestamptz default now(),
  resolved_at timestamptz,
  unique (user_id, service_id)
);

-- 7. Access grants — the actual unlock (only rows here = unlocked)
create table access_grants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  granted_at timestamptz default now(),
  unique (user_id, service_id)
);

-- 8. Service applications — anyone can apply to offer a service in a university/field.
-- Approving one creates the actual row in `services` (§19).
create table service_applications (
  id uuid primary key default uuid_generate_v4(),
  applicant_id uuid references profiles(id) on delete cascade,
  university_id uuid references universities(id),
  field_id uuid references fields(id),
  proposed_title text not null,
  proposed_description text,
  proposed_price numeric(10,2),
  status text not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
  admin_notes text,
  submitted_at timestamptz default now(),
  resolved_at timestamptz
);

-- Popularity view — powers "Most Bought" badges per field (§18). Public, counts only.
create or replace view service_popularity as
  select s.id as service_id, s.field_id, count(g.id) as purchase_count
  from services s
  left join access_grants g on g.service_id = s.id
  group by s.id;

-- 9. Browser push subscriptions (§20)
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);

-- 10. Audit log — every privileged/business-meaningful action, permanent record (§22).
-- No RLS policies granted below → nobody can read/write this except the backend's
-- service role. That's deliberate: an audit trail a student could edit isn't a trail.
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid,               -- profile id, null if unauthenticated (e.g. failed login)
  actor_type text not null,    -- 'admin' | 'student' | 'system'
  action text not null,        -- e.g. 'login.failed', 'access_request.approved'
  target_table text,
  target_id uuid,
  ip_address text,
  metadata jsonb,
  created_at timestamptz default now()
);
