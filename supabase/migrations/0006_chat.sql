-- =====================================================================
-- UniVault — Chat (service buyer <-> provider), migration 0006
-- Run this ONCE in the Supabase SQL editor (after 0001-0005 / schema+rls).
-- Idempotent: safe to re-run.
--
-- Security model:
--   * conversations/messages are written ONLY by the backend (service
--     role key, which bypasses RLS). anon/authenticated roles get SELECT
--     policies only — they can never INSERT/UPDATE/DELETE rows directly.
--   * SELECT is limited to the two participants of the conversation.
--   * messages SELECT additionally requires the conversation to be
--     unexpired (expires_at > now()), so expired chats are unreadable
--     even if a stale realtime subscription still tries to deliver.
-- =====================================================================

-- ---------------------------------------------------------------------
-- conversations — one per (service, buyer, provider) — never duplicated.
-- ---------------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid not null references services(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  provider_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (service_id, buyer_id, provider_id)
);

-- ---------------------------------------------------------------------
-- messages — plain text only, sender identity is backend-verified.
-- ---------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Query support: conversation history (newest-first pagination) and
-- unread-marking (sender_id + read_at is null). The unique constraint on
-- conversations already indexes (service_id, buyer_id, provider_id).
create index if not exists messages_conversation_created_idx on messages (conversation_id, created_at desc);
create index if not exists messages_sender_unread_idx on messages (conversation_id, sender_id) where read_at is null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table conversations enable row level security;
alter table messages enable row level security;

drop policy if exists "chat read own conversations" on conversations;
create policy "chat read own conversations" on conversations
  for select using (auth.uid() = buyer_id or auth.uid() = provider_id);

drop policy if exists "chat read own messages" on messages;
create policy "chat read own messages" on messages
  for select using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.provider_id = auth.uid())
        and c.expires_at > now()
    )
  );

-- No INSERT/UPDATE/DELETE policies on either table: the backend writes
-- via the service role key only. (Deliberate — same model as audit_log.)

-- ---------------------------------------------------------------------
-- Realtime: broadcast message inserts to subscribed clients. Delivery
-- is still subject to the RLS SELECT policies above, so only the two
-- participants ever receive rows.
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table conversations;
exception when duplicate_object then null;
end $$;
