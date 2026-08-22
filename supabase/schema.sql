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
  add column if not exists music_queue jsonb not null default '{"items":[],"current":0,"length":0}'::jsonb;

-- Caches the resolved, embed-verified YouTube video ids for a Spotify track so
-- youtube-match can skip the 100-unit search.list call on every track it has
-- already seen. Keyed by Spotify track id (not playlist), so a track shared
-- across playlists is resolved once. `youtube_ids` holds the verified candidate
-- list (up to VERIFIED_CANDIDATES_PER_TRACK), same order the search returned.
create table if not exists public.youtube_match_cache (
  spotify_track_id text primary key,
  youtube_ids      text[] not null,
  updated_at       timestamptz not null default now()
);

-- RLS enabled with no policies: unreachable via the anon key, only the Edge
-- Function (service role key) can read/write it -- same as spotify_catalog_token.
alter table public.youtube_match_cache enable row level security;

-- The answer key. One metadata row per lobby/Spotify track; clients can never
-- select it because RLS has no policies. Queue rows broadcast only track and
-- YouTube ids, while finish-round copies the current row into revealedTrack.
create table if not exists public.track_metadata (
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  track_id text not null,
  metadata jsonb not null,
  primary key (lobby_id, track_id)
);

alter table public.track_metadata enable row level security;

-- The ordered future playback queue. It is deliberately separate from the
-- realtime/public lobby row: even a YouTube id is enough to identify a future
-- answer. `start-round` reads one position and publishes only that round's
-- candidate ids into lobbies.music_queue.
create table if not exists public.lobby_music_queue (
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  position integer not null check (position >= 0),
  track_id text not null,
  youtube_ids text[] not null,
  primary key (lobby_id, position)
);

alter table public.lobby_music_queue enable row level security;

-- One-time/idempotent cleanup for lobbies created with the old public full
-- queue shape. Such lobbies must regenerate before they can start again, but
-- their future answer ids stop leaking immediately after this schema runs.
update public.lobbies
set music_queue = '{"items":[],"current":0,"length":0}'::jsonb
where not (music_queue ? 'length')
   or jsonb_array_length(coalesce(music_queue->'items', '[]'::jsonb)) > 1
   or coalesce(
     (music_queue->'items'->0) ?| array['name', 'artist', 'album', 'releaseDate', 'cover'],
     false
   );

-- Membership changes must be evaluated inside the UPDATE that locks the row.
-- Building a players array in the browser from a previously selected lobby
-- loses players when two joins (or a join and a presence cleanup) race.
create or replace function public.join_lobby(
  target_lobby_id uuid,
  joining_player jsonb
)
returns setof public.lobbies
language sql
security invoker
set search_path = public
as $$
  update public.lobbies
  set players = case
    -- Idempotent for a retried request or a double form submission.
    when exists (
      select 1
      from jsonb_array_elements(players) as existing_player
      where existing_player->>'id' = joining_player->>'id'
    ) then players
    else players || jsonb_build_array(joining_player)
  end
  where id = target_lobby_id
  returning *;
$$;

revoke all on function public.join_lobby(uuid, jsonb) from public;
grant execute on function public.join_lobby(uuid, jsonb) to anon, authenticated;

create or replace function public.leave_lobby(
  lobby_code text,
  leaving_player_id text
)
returns setof public.lobbies
language sql
security invoker
set search_path = public
as $$
  update public.lobbies
  set players = (
    select coalesce(jsonb_agg(player order by position), '[]'::jsonb)
    from jsonb_array_elements(players) with ordinality as item(player, position)
    where player->>'id' <> leaving_player_id
  )
  where code = lobby_code
  returning *;
$$;

revoke all on function public.leave_lobby(text, text) from public;
grant execute on function public.leave_lobby(text, text) to anon, authenticated;

-- Atomically changes only one player's answer, avoiding concurrent answer
-- submissions overwriting the whole players array. Callable only through the
-- service-role Edge Function.
create or replace function public.submit_lobby_answer(
  lobby_code text,
  submitted_player_id text,
  submitted_answer text,
  submitted_at bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lobbies
  set players = (
    select coalesce(jsonb_agg(
      case
        when player->>'id' = submitted_player_id
          and coalesce(player->>'answer', '') = ''
        then jsonb_set(
          jsonb_set(player, '{answer}', to_jsonb(submitted_answer)),
          '{answeredAt}', to_jsonb(submitted_at)
        )
        else player
      end
      order by position
    ), '[]'::jsonb)
    from jsonb_array_elements(players) with ordinality as item(player, position)
  )
  where code = lobby_code
    and game_state->>'status' in ('playing', 'paused')
    and exists (
      select 1 from jsonb_array_elements(players) as player
      where player->>'id' = submitted_player_id
    );

  if not found then
    raise exception 'Lobby, player, or active round not found';
  end if;
end;
$$;

revoke all on function public.submit_lobby_answer(text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.submit_lobby_answer(text, text, text, bigint)
  to service_role;

-- Commits grading and reveal only if the same round is still active. This is
-- the server-side counterpart of the client ref guard and prevents duplicate
-- payout from two finish triggers.
create or replace function public.finalize_lobby_round(
  lobby_code text,
  expected_round integer,
  scored_players jsonb,
  revealed_track jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.lobbies
  set players = scored_players,
      game_state = jsonb_set(
        jsonb_set(game_state, '{status}', '"finished"'::jsonb),
        '{revealedTrack}', revealed_track
      )
  where code = lobby_code
    and (game_state->>'round')::integer = expected_round
    and game_state->>'status' in ('playing', 'paused');

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.finalize_lobby_round(text, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_lobby_round(text, integer, jsonb, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Scheduled cleanup of abandoned lobbies
-- ---------------------------------------------------------------------------
-- The app already deletes a lobby when the host leaves with nobody to hand it
-- to (resolveHostDeparture), and Supabase presence catches closed tabs and
-- crashes. What neither can cover is the *last* connected client disappearing
-- ungracefully: presence "leave" events are only observed by the other
-- clients, so with nobody left in the lobby, nothing deletes the row. Such a
-- row keeps a fully populated `players` array -- it is abandoned, not empty --
-- which is why this sweeps on age rather than on emptiness, and why it has to
-- run in the database rather than in a client.
--
-- 24h is well past any real game. A client still sitting in a swept lobby
-- degrades gracefully: replica identity full is set above, so the DELETE
-- reaches subscribeToLobbyByCode and the player is sent home with a toast.

-- Also available from the dashboard: Database > Extensions > pg_cron.
create extension if not exists pg_cron;

create or replace function public.delete_stale_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.lobbies
  where created_at < now() - interval '24 hours';

  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- PostgREST exposes public functions as RPC, and this one is security definer:
-- keep it off the anon key.
revoke all on function public.delete_stale_lobbies() from public, anon, authenticated;

-- Hourly, not every few minutes: with a 24h TTL a tighter cadence only changes
-- which minute of the day a row dies, and costs a job run every time.
-- cron.schedule upserts by name, so re-running this file is safe.
-- To remove it: select cron.unschedule('delete-stale-lobbies');
select cron.schedule(
  'delete-stale-lobbies',
  '17 * * * *',
  $$select public.delete_stale_lobbies()$$
);
