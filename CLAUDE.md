# Bludster (`hitster-copy`)

A self-hosted Hitster clone: players join a lobby, a track plays, everyone types their guess, the
round pays out points.

**Stack:** React 19 + TypeScript + Vite + Tailwind v4 (SPA) · Supabase (Postgres + Realtime + Edge
Functions), the only backend · Spotify for metadata, YouTube IFrame API for playback.

**No test framework. No auth system.** Verification is manual.

> **The UI is French** — every user-facing string. Code, comments and type names are English.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, bound to `127.0.0.1` |
| `npm run build` | `tsc -b && vite build` — typechecks, then builds |
| `npm run lint` | ESLint (flat config, TS + react-hooks + react-refresh) |
| `npm run preview` | Serve the production build |
| `npm run warm-cache` | Fill the YouTube match cache (see Playback) |

- `noUnusedLocals`/`noUnusedParameters` are on and `build` runs `tsc -b` first — an unused variable
  **fails the build**, not just the lint.
- `vite.config.ts` pins the dev server to `127.0.0.1` (Spotify-redirect holdover); harmless, leave it.

**Environment.** Frontend: `.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Edge
Functions have **separate** dashboard secrets: `SPOTIFY_CLIENT_ID`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` (`spotify-playlist`) and `YOUTUBE_API_KEY` (`youtube-match`, a static
YouTube Data API v3 key). No frontend Spotify credentials.

---

## Architecture

Dependencies flow one way. Components are presentational — data and callbacks come as props.

```
pages/  →  hooks/  →  lib/{lobbies,spotify,youtube,scoring,playback}  →  lib/supabaseClient
                ↘  components/  (presentational only)
```

| Path | Responsibility |
| --- | --- |
| `src/pages/` | `Home`, `Game`. Routes in `App.tsx`: `/` · `/create` · `/join` · `/game/:code`. |
| `src/hooks/` | Stateful glue: `useLobbyRealtime`, `useGameActions`, `useYoutubePlayer`, `useYoutubePlayback`, `useRoundLifecycle`, `useAnswerChime`, `useMusicQueue`, `usePlayerIdentity`, form hooks. |
| `src/lib/lobbies/` | **Every** Supabase read/write. `rowOperations.ts` holds shared read-modify-write plumbing incl. `regenerateMusicQueue`. |
| `src/lib/scoring/` | Pure grading. No imports outside `types`. |
| `src/lib/playback/` | Pure round clock (`elapsedMs`, `remainingSeconds`) + `resolvePlaybackIntent`. Backend-agnostic (opaque track id). |
| `src/lib/spotify/` | `playlist` — the catalog-metadata Edge Function call. |
| `src/lib/youtube/` | `search` (track → video ids), `player` (IFrame API + `YT.Player`). |
| `src/types/index.ts` | All shared types (`somethingProps` naming). |
| `src/constants/createGameOptions.ts` | Playlists, game modes, question text, duration bounds. |
| `supabase/` | `schema.sql` + Edge Functions `spotify-playlist` and `youtube-match`. |

**`Game.tsx` is composition only** — no game logic; it resolves the lobby, derives the host role, and
wires five hooks to four children:

| Hook | Owns |
| --- | --- |
| `useLobbyRealtime` | The row, plus `notFound`/`kicked`. |
| `useGameActions` | Every user-initiated mutation + presence subscription. |
| `useYoutubePlayback` | Driving this tab's player from the row — every player, not just host. |
| `useRoundLifecycle` | Round clock and payout (`finalizeRound`, `roundFinalizedRef`). |
| `useAnswerChime` | The pop sound when one more player answers. |

Children: `GameStage` (the `<main>`, → `PodiumStage` once `ended`), `GameFooter`, `PlayersModal`,
`SettingsModal`. None import from `lib/` — a control needing a mutation gets a handler from
`useGameActions`.

---

## The single source of truth: one `lobbies` row

**The entire game state lives in one Postgres row.** No server-side logic — every client mirrors the
row over Realtime and decides what to write.

```
lobbies
  code          text unique  -- 4-digit, codeGenerator.ts
  password_hash text         -- bcrypt, checked client-side in useJoinGameForm
  is_public     boolean
  category      jsonb        -- chosen playlist { value, label }
  game_state    jsonb        -- gameStateProps: status, mode, questionMode, round, duration,
                             --   roundStartedAt/pausedElapsedMs (round clock)…
  players       jsonb        -- playerProps[]: id, pseudo, host, score, answer, roundPoints…
  music_queue   jsonb        -- playlistQueueProps { items, current }; current written only by startRound
```

1. **`rowToLobby` (`mappers.ts`) is the only DB→app boundary, and it renames:** `is_public`→`public`,
   `code`→`generatedCode`, `players`→`player` (singular name, still an array). Never pass a raw row to the UI.
2. **Every mutation is a read-modify-write on jsonb, so concurrent writers clobber each other** — this
   is why several ops are host-only.
3. **RLS is wide open** — anyone with the anon key can read/insert/update/delete any lobby
   (prototype-grade). A blocked delete looks like success, so `deleteLobby` checks the returned `count`.
4. **`replica identity full` is set** so DELETE realtime events carry every column — otherwise a
   `code=eq.xxxx` filter on DELETE never matches and clients never learn the lobby closed.

Two service-role-only tables have RLS on with **no policies**: `spotify_catalog_token`,
`youtube_match_cache`.

---

## Game loop

```
waiting ──start──► playing ◄──resume/pause──► paused
   ▲                  │
   │              round ends ──► finished ──new round──► playing
   │                                │ (last round)
   └────── nouvelle partie ─────── ended
```

Status is `game_state.status` (`GameStatus`). **Host presses a button** → `hostActionByStatus`
(`useGameActions.ts`) maps status to a handler. Starting the game and the next round are the **same
op**, `startRound`.

- **`finished` on the last round → `ended`, not another round.** `isFinalRound` (`src/util/`) decides;
  `hostActionByStatus` swaps `startRound` for a write of `Ended`. Bounded by **queue length as well as
  `totalRounds`** (playlist may yield fewer tracks); without it `startRound` replays the final track forever.
- **`ended` is a row status, not local state** — every client must reach the podium together. Resolves to
  the **`pause`** intent. `Game.tsx` renders `PodiumStage`; `GameFooter` withholds the host action +
  "relancer la partie" so the podium owns the sole CTA, gated on **`isHostPlayer`**.
- **`startRound` is one atomic write** — answers, question, `round`, `status`, round clock and
  `music_queue.current` in a single `update`. **`current` is derived from `round`, never incremented**
  (per-client increments raced and permanently skewed the queue); and clients **never see a half-started
  round** (splitting it let `playing` arrive before the track).
- **The countdown is derived, not decremented.** `roundStartedAt` is the epoch ms of position 0; clients
  compute `remainingSeconds` (`src/lib/playback/`) against it. `pauseRound` freezes elapsed into
  `pausedElapsedMs`; `resumeRound` rewinds `roundStartedAt` by it. A skewed client clock skews its own
  countdown — values clamp to `[0, duration]`.
- **Only the host ends the round** (scoring rewrites the whole `players` array; concurrent writers clobber
  scores). In `useRoundLifecycle`, gated on `isHostPlayer`. Two triggers funnel through `finalizeRound`:
  countdown hits 0, or every player answered.
- **Double-payout is guarded twice:** `roundFinalizedRef` and a `status === Finished` check in
  `finishRound`. The ref is a **boolean, not a round number** — a restart resets `round` to 0, and a
  remembered number would block the new game's round 1. `finalizeRound` keeps empty `useCallback` deps and
  reads the track from `roundTrackRef` (it's a dep of both round-ending effects).
- **`finishRound` writes scores and status in one update**, so the reveal never shows stale points.
- **The track plays through the reveal:** `finished` resolves to `idle` (players hear the song), not
  `play` — `elapsedMs` has passed the duration, so a position would seek past the end. Next `startRound`
  replaces it; "relancer la partie" (→ `waiting`) stops it.

**`mode` vs `questionMode`** (both in `game_state`, both persisted): `mode` is what the host configured
(may be `random`); `questionMode` is what *this* round asks. Identical except under `Aleatoire`, where
`resolveGameQuestion` (`src/util/`) draws a mode per round — both must persist since the scorer can't
grade from question text alone. `Titre` and `Album` are excluded from random draws
(`RANDOM_MODE_EXCLUSIONS`): one needs soundtrack playlists, the other is unscored.

---

## Scoring (`src/lib/scoring/`)

Pure and dependency-free — if tests are ever added, start here.

| Mode | Exact | Closest |
| --- | --- | --- |
| Année | 15 | 7 |
| Musique | 10 | — |
| Titre | 10 | — |
| Artiste | 8 | — |
| Décennie | 5 | 3 |
| Album | **0** | — |

- **`Album` is deliberately unscored** — absence from `MODE_POINTS` means zero, not a bug.
- **Numeric modes (`Année`, `Décennie`) grade across the whole table at once:** if anyone is exact, the
  closest-guess consolation is cancelled for everyone. Unparseable answers sit the round out.
- **Text modes** go through `normalizeText` (`normalize.ts`) — strips Spotify decoration players never
  hear (`- Remastered 2011`, `(feat. X)`), accents, punctuation, leading articles — then Levenshtein at
  `similarity >= 0.85`.
- **`expectedAnswer` shares its per-mode switch with the scorer on purpose**, so the revealed answer
  can't drift from the graded one. Keep them together.
- **`parseReleaseYear` slices the string instead of `new Date()`** — a date-only string parses as UTC
  midnight, so `getFullYear()` renders `"1984-01-01"` as 1983 west of Greenwich.

---

## Playback: YouTube, not Spotify

**Every client runs its own `YT.Player`** (playback used to be a single Spotify SDK tab) — no relay,
no Spotify auth in the frontend.

- **Spotify is metadata-only.** `fetchPlaylistTracks` (`spotify/playlist.ts`) supplies
  title/artist/release date/album/cover, which scoring grades off. What plays is a YouTube video:
  `regenerateMusicQueue` attaches a `youtubeIds: string[]` candidate list per track. Tracks with no
  candidate are dropped, so the fetch asks Spotify for `rounds * 1.3`; a short queue is handled
  (`isFinalRound` bounded by queue length).
- **Lobby creation is cache-only → zero YouTube quota.** `regenerateMusicQueue` calls
  `matchYoutubeVideos(tracks, { cacheOnly: true })`; `youtube-match` serves candidates purely from
  `youtube_match_cache` — no search, no verify, no API key. Uncached tracks are dropped; if *nothing* is
  cached, it throws a French error rather than write an unplayable lobby. Fill the cache first with
  `npm run warm-cache`.
- **Warming (`scripts/warm-youtube-cache.mjs`, `npm run warm-cache`).** Default mode resolves candidate
  ids via YouTube's public innertube search (**zero Data API quota**) and hands them to `youtube-match`
  to verify + cache. Fetches every playlist in full, dedups across playlists, records progress locally so
  re-runs never re-resolve. `--api-search` uses the metered 100-unit `search.list` path.
- **`youtube-match` search path is two-stage:** `search.list?videoEmbeddable=true` for up to 8 raw
  candidates, then a batched `videos.list?part=status` (chunked at 50) keeps only currently-embeddable
  ones (the search index lags real status). Up to `VERIFIED_CANDIDATES_PER_TRACK` (5) survivors in
  relevance order; `youtubeIds` carries the whole list so a bad pick isn't a dead end. Its API/cache calls
  **throw only on HTTP failure** (quota, bad key), never on empty results — a systemic failure (500) stays
  distinct from "no matches" instead of silently writing an empty queue.
- **Only `isHostPlayer` exists — no `isHost`.** The host flag gates everything (playback, volume,
  settings, skip/restart, scoring, kick/promote). A narrower "can this browser play" flag is likely the
  old device-gating bug inverted.
- **Every player runs its own reconciler.** `useYoutubePlayer` owns a plain component-scoped ref (no
  cross-page singleton needed), called unconditionally in `Game.tsx`. `useYoutubePlayback` applies
  `resolvePlaybackIntent` against it, deduping via `appliedRef` (keyed on the first candidate as a stable
  identity). Each client reconciles independently — no host-handoff bookkeeping.
- **Candidates are a runtime fallback chain.** On `onError` (a verified candidate can still fail live)
  `useYoutubePlayer` advances to the next via `attemptRef`, toasting only once all are exhausted — the
  reconciler never sees this (`resume()` resolves once it *starts* an attempt). `resume` also plays in
  place without seeking when the player already holds the id (else the `resumeRound` rewind would stutter).
- **Audio-unlock gesture:** browsers only allow the first play inside a user-gesture stack playing real
  content, so `unlock(...)` **is** the round's first playback (`resume()` marking `isUnlocked`), not
  priming. `Game.tsx` offers it only when `canUnlock`; `useYoutubePlayback` early-returns while
  `!isUnlocked`. Every fresh page load needs one click — the browser resets user-gesture state on reload.
- **Host handoff freezes the round clock.** `promotePlayer` force-pauses a `playing` game and freezes
  `pausedElapsedMs`. Ungraceful disconnects are caught by Supabase presence in `useGameActions`;
  `pickSuccessorPlayer` picks deterministically (lowest id).

---

## Conventions

- **Types.** `somethingProps` naming. Enums are const objects + a derived union, never TS `enum`:
  ```ts
  export const GameStatus = { Waiting: "waiting", /* … */ } as const;
  export type GameStateEnum = (typeof GameStatus)[keyof typeof GameStatus];
  ```
  `verbatimModuleSyntax` is on, so type-only imports **must** use `import type`.
- **Formatting.** Tabs. Double quotes in `.ts`/`.tsx`, single quotes for JSX attributes.
- **Styling.** Tailwind v4 with `@theme` tokens in `src/index.css` (`bg-deep`, `purple`, `purple-light`,
  `purple-soft`, `accent-blue`, `lavender`, `font-display`/`font-body`). **Use tokens, never raw hex**;
  opacity modifiers (`text-lavender/68`) are house style. Four `@utility` classes carry repeated strings:
  `glass-panel` (bordered translucent surfaces), `field-input` (inputs — **surface + focus ring only**,
  padding/font per-site), `field-label`, `control-shell` (box around a toggle/slider).
- **Shared UI.** Buttons from `Button.tsx`: `PrimaryButton`, `SecondaryButton`, `IconButton` (square
  icon-only; `label` = aria-label + title, plus `icon`) — don't hand-roll. `DurationSlider` is the
  shared length control; give each call site a distinct `id`. Icons are inline SVG in
  `src/components/icons/`.
- **Modals** portal into `#modal-root` and handle focus/Escape/scroll-lock. `Modal.tsx` exports
  `ModalHeader`, `ModalBody`, `ModalCloseButton` — compose those.
- **Toasts.** `showToast(text, variant)` from `src/lib/toast.ts`; variants `join | leave | closed | error`.
- **Commits.** `[FEAT]`/`[FIX]` prefix; subjects often French.

---

## Gotchas

- **Import from the `lib/lobbies` barrel** (re-exports `promotePlayer`, `updatePlayerAnswer`,
  `updateGameSettings`, …). `rowToLobby`/`rowOperations` helpers are internal. `lib/scoring`'s barrel is
  deliberately narrow (`scoreRound`, `expectedAnswer`, `parseReleaseYear`).
- **Realtime `postgres_changes` filters evaluate against the NEW row on UPDATE** — a public→private
  toggle wouldn't match `is_public=eq.true`, so `subscribeToPublicLobbies` subscribes to all changes and
  re-queries with the filter server-side.
- **The current player's identity is a `?current=` query param** (read in `Game.tsx`). No auth — a
  stale/foreign id is treated as kicked by `checkStillMember` in `useLobbyRealtime`.
- **`createGameOptions.ts`** has a `"Test"` playlist marked `// remove in production`.
  `TITLE_ONLY_PLAYLISTS` lists soundtrack playlists offering only `Titre`, read by
  `filterGameModesForCategory` (`src/util/`).
- **Read-modify-write races** (see the lobby row section). `updateLobbyRow` removes boilerplate but is
  **not** atomic — before adding a mutation, ask who can call it concurrently. Cautionary tale: a
  `current + 1` in a `useEffect` ran on every client at once.
- **Don't split a round transition into several writes** — each `update` is its own broadcast, so N
  writes = N partial-state renders. `updateRound`/`updateGameQuestion`/`resetPlayerAnswer` were removed;
  `startRound` replaces all three.
- **`LobbyQuestionBox` is mounted twice on purpose** — a desktop copy (`hidden lg:flex` left column) and
  a `compact` copy above the album art (`lg:hidden`); each passes its own `inputId`. `compact` isn't a
  mobile flag — the desktop copy takes it while the settings panel is expanded, so `LobbySettingsPanel`
  is **controlled** from `GameStage`. `GameStage` also hides `PlayerAvatarList` on mobile for
  `playing`/`paused`/`finished`.
- **Mobile scrolls stage and footer together** — `Game.tsx` wraps them in one `overflow-y-auto` column
  (`lg:contents`, dissolves on desktop); stages carry `lg:min-h-0`. `PageBackground` stays `h-dvh
  overflow-hidden` everywhere to clip the drifting blobs.
- **`rankPlayers` (`src/util/`) returns the pre-sort index as `toneIndex`** — `PlayerAvatar` picks its
  gradient from it, so a player keeps its colour as standings move. Don't re-derive via sort + `findIndex`.
- **One pre-existing lint error** in `LobbyQuestionBox.tsx` (`react-hooks/set-state-in-effect`). Exactly
  one problem from `npm run lint` is the clean baseline.

---

## Current state

`TODO.MD` is the live roadmap — trust it over this section.

- **`Album` mode awards no points** (deliberately absent from `MODE_POINTS`) — not a bug.
- **One known race is left open:** the skip button calls `finishRound` without setting
  `roundFinalizedRef`, so a countdown hitting 0 just before the update can attempt a second payout. Only
  the server-side `status === Finished` guard stops it. Routing skip through `finalizeRound` would close it.
