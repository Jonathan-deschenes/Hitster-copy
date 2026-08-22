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

drop policy if exists "Anyone can read lobbies" on public.lobbies;
create policy "Anyone can read lobbies"
  on public.lobbies for select
  using (true);

drop policy if exists "Anyone can create a lobby" on public.lobbies;
create policy "Anyone can create a lobby"
  on public.lobbies for insert
  with check (true);

drop policy if exists "Anyone can update a lobby (e.g. join, add player)" on public.lobbies;
create policy "Anyone can update a lobby (e.g. join, add player)"
  on public.lobbies for update
  using (true);

drop policy if exists "Anyone can delete a lobby" on public.lobbies;
create policy "Anyone can delete a lobby"
  on public.lobbies for delete
  using (true);

-- Enable realtime so clients can subscribe to live changes (players joining).
-- The catalog check keeps this schema safe to re-run on an existing project.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lobbies'
  ) then
    alter publication supabase_realtime add table public.lobbies;
  end if;
end;
$$;

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

-- One revocable, unguessable lease per player tab. The token proves which
-- session may renew/leave; timestamps establish liveness (a JWT cannot do
-- that because closing a browser does not revoke or expire it).
create table if not exists public.lobby_player_sessions (
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  player_id text not null,
  session_token uuid not null unique,
  last_seen timestamptz not null default clock_timestamp(),
  disconnecting_at timestamptz,
  primary key (lobby_id, player_id)
);

alter table public.lobby_player_sessions enable row level security;

-- Session rows are private. Anonymous clients can only touch their own lease
-- through the token-validating security-definer functions below.
revoke all on table public.lobby_player_sessions from anon, authenticated;

-- Remove the earlier snapshot-based RPC overloads during upgrades.
drop function if exists public.join_lobby(uuid, jsonb);
drop function if exists public.leave_lobby(text, text);

create or replace function public.pause_lobby_state(current_state jsonb)
returns jsonb
language sql
volatile
set search_path = public
as $$
  select case
    when current_state->>'status' = 'playing' then
      jsonb_set(
        jsonb_set(current_state, '{status}', '"paused"'::jsonb),
        '{pausedElapsedMs}',
        to_jsonb(greatest(
          0::bigint,
          floor(extract(epoch from clock_timestamp()) * 1000)::bigint
            - coalesce(
                (current_state->>'roundStartedAt')::bigint,
                floor(extract(epoch from clock_timestamp()) * 1000)::bigint
              )
        )),
        true
      )
    else current_state
  end;
$$;

revoke all on function public.pause_lobby_state(jsonb) from public, anon, authenticated;

-- The sole membership-removal primitive. The row lock, session revocation,
-- host election, clock pause and players update are one transaction.
create or replace function public.remove_lobby_players(
  target_lobby_id uuid,
  removed_player_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lobby_row public.lobbies%rowtype;
  remaining_players jsonb;
  successor_id text;
begin
  select * into lobby_row
  from public.lobbies
  where id = target_lobby_id
  for update;

  if not found then return; end if;

  select coalesce(jsonb_agg(player order by position), '[]'::jsonb)
  into remaining_players
  from jsonb_array_elements(lobby_row.players)
       with ordinality as item(player, position)
  where not (player->>'id' = any(removed_player_ids));

  delete from public.lobby_player_sessions
  where lobby_id = target_lobby_id
    and player_id = any(removed_player_ids);

  if jsonb_array_length(remaining_players) = 0 then
    delete from public.lobbies where id = target_lobby_id;
    return;
  end if;

  -- Repair hostless lobbies as well as transferring a departing host.
  if not exists (
    select 1 from jsonb_array_elements(remaining_players) as player
    where coalesce((player->>'host')::boolean, false)
  ) then
    select player->>'id' into successor_id
    from jsonb_array_elements(remaining_players)
         with ordinality as item(player, position)
    order by position
    limit 1;

    select jsonb_agg(
      jsonb_set(
        player,
        '{host}',
        to_jsonb(player->>'id' = successor_id),
        true
      )
      order by position
    )
    into remaining_players
    from jsonb_array_elements(remaining_players)
         with ordinality as item(player, position);

    lobby_row.game_state := public.pause_lobby_state(lobby_row.game_state);
  end if;

  update public.lobbies
  set players = remaining_players,
      game_state = lobby_row.game_state
  where id = target_lobby_id;
end;
$$;

revoke all on function public.remove_lobby_players(uuid, text[])
  from public, anon, authenticated;

create or replace function public.expire_lobby_sessions_for_lobby(
  target_lobby_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_ids text[];
begin
  select array_agg(player_id) into expired_ids
  from public.lobby_player_sessions
  where lobby_id = target_lobby_id
    and (
      disconnecting_at < clock_timestamp() - interval '15 seconds'
      or last_seen < clock_timestamp() - interval '5 minutes'
    );

  if coalesce(array_length(expired_ids, 1), 0) > 0 then
    perform public.remove_lobby_players(target_lobby_id, expired_ids);
  end if;
end;
$$;

revoke all on function public.expire_lobby_sessions_for_lobby(uuid)
  from public, anon, authenticated;

create or replace function public.join_lobby(
  target_lobby_id uuid,
  joining_player jsonb,
  joining_session_token uuid
)
returns setof public.lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  lobby_row public.lobbies%rowtype;
begin
  if nullif(joining_player->>'id', '') is null then
    raise exception 'Player id is required';
  end if;

  select * into lobby_row
  from public.lobbies
  where id = target_lobby_id
  for update;

  if not found then return; end if;

  if lobby_row.game_state->>'status' <> 'waiting' then
    raise exception 'Lobby has already started';
  end if;

  insert into public.lobby_player_sessions (
    lobby_id, player_id, session_token, last_seen, disconnecting_at
  ) values (
    target_lobby_id,
    joining_player->>'id',
    joining_session_token,
    clock_timestamp(),
    null
  )
  on conflict (lobby_id, player_id) do update
  set last_seen = excluded.last_seen,
      disconnecting_at = null
  where lobby_player_sessions.session_token = excluded.session_token;

  if not found then
    raise exception 'This player id already has another active session';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(lobby_row.players) as player
    where player->>'id' = joining_player->>'id'
  ) then
    lobby_row.players := lobby_row.players || jsonb_build_array(
      joining_player || jsonb_build_object('host', false)
    );
    update public.lobbies
    set players = lobby_row.players
    where id = target_lobby_id;
  end if;

  return query select * from public.lobbies where id = target_lobby_id;
end;
$$;

revoke all on function public.join_lobby(uuid, jsonb, uuid) from public;
grant execute on function public.join_lobby(uuid, jsonb, uuid) to anon, authenticated;

create or replace function public.heartbeat_lobby_session(
  lobby_code text,
  session_player_id text,
  provided_session_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_lobby_id uuid;
begin
  select id into target_lobby_id
  from public.lobbies
  where code = lobby_code
  for update;

  if target_lobby_id is null then return false; end if;

  update public.lobby_player_sessions as session
  set last_seen = clock_timestamp(),
      disconnecting_at = null
  where session.lobby_id = target_lobby_id
    and session.player_id = session_player_id
    and session.session_token = provided_session_token;

  if not found then return false; end if;

  perform public.expire_lobby_sessions_for_lobby(target_lobby_id);
  return exists (
    select 1 from public.lobby_player_sessions
    where lobby_id = target_lobby_id
      and player_id = session_player_id
      and lobby_player_sessions.session_token = provided_session_token
  );
end;
$$;

revoke all on function public.heartbeat_lobby_session(text, text, uuid) from public;
grant execute on function public.heartbeat_lobby_session(text, text, uuid)
  to anon, authenticated;

create or replace function public.mark_lobby_session_disconnecting(
  lobby_code text,
  session_player_id text,
  provided_session_token uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lobby_player_sessions as session
  set disconnecting_at = clock_timestamp()
  from public.lobbies as lobby
  where lobby.id = session.lobby_id
    and lobby.code = lobby_code
    and session.player_id = session_player_id
    and session.session_token = provided_session_token;
$$;

revoke all on function public.mark_lobby_session_disconnecting(text, text, uuid)
  from public;
grant execute on function public.mark_lobby_session_disconnecting(text, text, uuid)
  to anon, authenticated;

create or replace function public.leave_lobby(
  lobby_code text,
  leaving_player_id text,
  leaving_session_token uuid
)
returns setof public.lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  target_lobby_id uuid;
begin
  select lobby.id into target_lobby_id
  from public.lobbies as lobby
  join public.lobby_player_sessions as session on session.lobby_id = lobby.id
  where lobby.code = lobby_code
    and session.player_id = leaving_player_id
    and session.session_token = leaving_session_token;

  if target_lobby_id is null then return; end if;
  perform public.remove_lobby_players(target_lobby_id, array[leaving_player_id]);
  return query select * from public.lobbies where id = target_lobby_id;
end;
$$;

revoke all on function public.leave_lobby(text, text, uuid) from public;
grant execute on function public.leave_lobby(text, text, uuid) to anon, authenticated;

create or replace function public.kick_lobby_player(
  lobby_code text,
  host_player_id text,
  host_session_token uuid,
  target_player_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_lobby_id uuid;
begin
  select lobby.id into target_lobby_id
  from public.lobbies as lobby
  join public.lobby_player_sessions as session on session.lobby_id = lobby.id
  where lobby.code = lobby_code
    and session.player_id = host_player_id
    and session.session_token = host_session_token
    and exists (
      select 1 from jsonb_array_elements(lobby.players) as player
      where player->>'id' = host_player_id
        and coalesce((player->>'host')::boolean, false)
    );

  if target_lobby_id is null then raise exception 'Active host session required'; end if;
  if host_player_id = target_player_id then raise exception 'Host cannot kick itself'; end if;
  perform public.remove_lobby_players(target_lobby_id, array[target_player_id]);
end;
$$;

revoke all on function public.kick_lobby_player(text, text, uuid, text) from public;
grant execute on function public.kick_lobby_player(text, text, uuid, text)
  to anon, authenticated;

create or replace function public.promote_lobby_player(
  lobby_code text,
  host_player_id text,
  host_session_token uuid,
  target_player_id text
)
returns setof public.lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  target_lobby_id uuid;
  current_state jsonb;
begin
  select lobby.id, lobby.game_state into target_lobby_id, current_state
  from public.lobbies as lobby
  join public.lobby_player_sessions as session on session.lobby_id = lobby.id
  where lobby.code = lobby_code
    and session.player_id = host_player_id
    and session.session_token = host_session_token
    and exists (
      select 1 from jsonb_array_elements(lobby.players) as player
      where player->>'id' = host_player_id
        and coalesce((player->>'host')::boolean, false)
    )
    and exists (
      select 1 from jsonb_array_elements(lobby.players) as player
      where player->>'id' = target_player_id
    )
  for update of lobby;

  if target_lobby_id is null then raise exception 'Active host and target required'; end if;

  update public.lobbies
  set players = (
        select jsonb_agg(
          jsonb_set(player, '{host}', to_jsonb(player->>'id' = target_player_id), true)
          order by position
        )
        from jsonb_array_elements(players) with ordinality as item(player, position)
      ),
      game_state = public.pause_lobby_state(current_state)
  where id = target_lobby_id;

  return query select * from public.lobbies where id = target_lobby_id;
end;
$$;

revoke all on function public.promote_lobby_player(text, text, uuid, text) from public;
grant execute on function public.promote_lobby_player(text, text, uuid, text)
  to anon, authenticated;

-- Starts a round from the latest locked players array. The Edge Function
-- resolves the private track/question, but this statement owns the state
-- transition so a join racing the host's Start click is either included or
-- rejected after the lobby has started -- never silently overwritten.
create or replace function public.start_lobby_round(
  target_lobby_id uuid,
  expected_status text,
  expected_round integer,
  next_round integer,
  next_question text,
  next_question_mode text,
  playback_track jsonb,
  queue_length integer,
  started_at bigint
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
  set players = (
        select coalesce(jsonb_agg(
          (player - 'answeredAt') || jsonb_build_object(
            'answer', '',
            'roundPoints', 0,
            'roundCorrect', false
          )
          order by position
        ), '[]'::jsonb)
        from jsonb_array_elements(players) with ordinality as item(player, position)
      ),
      game_state =
        (game_state - 'pausedElapsedMs' - 'revealedTrack') || jsonb_build_object(
          'question', next_question,
          'questionMode', next_question_mode,
          'round', next_round,
          'status', 'playing',
          'roundStartedAt', started_at
        ),
      music_queue = jsonb_build_object(
        'items', jsonb_build_array(playback_track),
        'current', 0,
        'length', queue_length
      )
  where id = target_lobby_id
    and game_state->>'status' = expected_status
    and (game_state->>'round')::integer = expected_round;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.start_lobby_round(
  uuid, text, integer, integer, text, text, jsonb, integer, bigint
) from public, anon, authenticated;
grant execute on function public.start_lobby_round(
  uuid, text, integer, integer, text, text, jsonb, integer, bigint
) to service_role;

-- Settings/restart also derives its score reset from the players value held
-- by the UPDATE, instead of a browser snapshot selected before a join.
create or replace function public.update_lobby_settings(
  lobby_code text,
  next_public boolean,
  next_category jsonb,
  next_mode text,
  next_question text,
  next_question_mode text,
  next_rounds integer,
  next_duration integer
)
returns setof public.lobbies
language sql
security invoker
set search_path = public
as $$
  update public.lobbies
  set is_public = next_public,
      category = next_category,
      game_state =
        (game_state - 'roundStartedAt' - 'pausedElapsedMs' - 'revealedTrack')
        || jsonb_build_object(
          'round', 0,
          'mode', next_mode,
          'status', 'waiting',
          'question', next_question,
          'questionMode', next_question_mode,
          'totalRounds', next_rounds,
          'duration', next_duration
        ),
      players = (
        select coalesce(jsonb_agg(
          (player - 'answeredAt') || jsonb_build_object(
            'answer', '',
            'roundPoints', 0,
            'roundCorrect', false,
            'score', 0
          )
          order by position
        ), '[]'::jsonb)
        from jsonb_array_elements(players) with ordinality as item(player, position)
      )
  where code = lobby_code
  returning *;
$$;

revoke all on function public.update_lobby_settings(
  text, boolean, jsonb, text, text, text, integer, integer
) from public;
grant execute on function public.update_lobby_settings(
  text, boolean, jsonb, text, text, text, integer, integer
) to anon, authenticated;

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
  set players = (
        select coalesce(jsonb_agg(
          coalesce(
            (
              select scored
              from jsonb_array_elements(scored_players) as scored
              where scored->>'id' = current_player->>'id'
              limit 1
            ),
            current_player
          )
          order by position
        ), '[]'::jsonb)
        from jsonb_array_elements(players)
             with ordinality as item(current_player, position)
      ),
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
-- Session leases normally remove closed/crashed players and delete the lobby
-- when its final session expires. This age-based sweep remains as a last-line
-- cleanup for legacy rows and any lobby that predates or somehow missed its
-- session records.
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

-- Backstop when every browser in a lobby disappears and no active heartbeat
-- remains to perform the per-lobby lease cleanup.
create or replace function public.expire_lobby_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
begin
  for target in
    select distinct lobby_id from public.lobby_player_sessions
  loop
    perform public.expire_lobby_sessions_for_lobby(target.lobby_id);
  end loop;
end;
$$;

revoke all on function public.expire_lobby_sessions()
  from public, anon, authenticated;

-- Hourly, not every few minutes: with a 24h TTL a tighter cadence only changes
-- which minute of the day a row dies, and costs a job run every time.
-- cron.schedule upserts by name, so re-running this file is safe.
-- To remove it: select cron.unschedule('delete-stale-lobbies');
select cron.schedule(
  'delete-stale-lobbies',
  '17 * * * *',
  $$select public.delete_stale_lobbies()$$
);

select cron.schedule(
  'expire-lobby-sessions',
  '* * * * *',
  $$select public.expire_lobby_sessions()$$
);
