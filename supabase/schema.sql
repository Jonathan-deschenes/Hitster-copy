-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  is_public boolean not null default true,
  code text not null unique,
  category jsonb not null,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Row Level Security: this app has no auth system yet, so every client
-- uses the public "anon" key. These policies let any client read, create,
-- and update lobbies (needed for the join flow to add a player). This is
-- fine for a prototype but is NOT production-grade access control.
alter table public.lobbies enable row level security;

create policy "Anyone can read lobbies"
  on public.lobbies for select
  using (true);

create policy "Anyone can create a lobby"
  on public.lobbies for insert
  with check (true);

create policy "Anyone can update a lobby (e.g. join, add player)"
  on public.lobbies for update
  using (true);

create policy "Anyone can delete a lobby"
  on public.lobbies for delete
  using (true);

-- Enable realtime so clients can subscribe to live changes (players joining).
alter publication supabase_realtime add table public.lobbies;

-- By default Postgres only includes the primary key in the "old record" sent
-- with UPDATE/DELETE realtime events, so a `filter: code=eq.xxxx` on a DELETE
-- would never match. FULL replica identity includes every column instead.
alter table public.lobbies replica identity full;
