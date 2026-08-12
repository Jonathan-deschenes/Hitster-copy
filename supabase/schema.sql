-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  is_public boolean not null default true,
  code text not null unique,
  category jsonb not null,
  game_state jsonb not null default '{"status":"waiting","round":0,"totalRounds":10}'::jsonb,
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

-- Stores the Spotify "catalog" service account's refresh token. Spotify's
-- PKCE refresh tokens are single-use: every refresh call invalidates the
-- current one and returns a new one, so it must live in a row the
-- spotify-playlist Edge Function can update after every use, not a static
-- secret. Single-row table, id is always 1.
create table if not exists public.spotify_catalog_token (
  id smallint primary key default 1,
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  constraint spotify_catalog_token_singleton check (id = 1)
);

-- RLS enabled with no policies: unreachable via the public anon/publishable
-- key. Only the Edge Function (using the service role key) can read/write it.
alter table public.spotify_catalog_token enable row level security;

-- Persists the shuffled music queue on the lobby row (shape: playlistQueueProps)
-- so every client sees the same queue via realtime, instead of each client
-- fetching/shuffling its own copy from Spotify.
alter table public.lobbies
  add column if not exists music_queue jsonb not null default '{"items":[],"current":0}'::jsonb;
