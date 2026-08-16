# Bludster (`hitster-copy`)

A self-hosted clone of the Hitster music guessing game. Players join a lobby, a track plays,
everyone types what they think the answer is, and the round pays out points.

**Stack:** React 19 + TypeScript + Vite + Tailwind v4 (SPA) · Supabase (Postgres + Realtime +
Edge Functions) as the only backend · Spotify catalog for track metadata, YouTube IFrame API for
audio playback.

**No test framework. No auth system.** Verification is manual.

> **The UI is French.** Every user-facing string — buttons, toasts, errors, questions — must be
> written in French. Code, comments and type names are in English.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, bound to `127.0.0.1` |
| `npm run build` | `tsc -b && vite build` — typechecks, then builds |
| `npm run lint` | ESLint (flat config, TS + react-hooks + react-refresh) |
| `npm run preview` | Serve the production build |

`vite.config.ts` still pins the dev server to `127.0.0.1` — a holdover from when Spotify's redirect
URI had to match literally. Playback no longer involves any per-user Spotify login, so this isn't
load-bearing anymore, but there's no reason to unpin it either.

`npm run build` runs `tsc -b` first, and `noUnusedLocals` / `noUnusedParameters` are enabled in
`tsconfig.app.json` — an unused variable fails the build, not just the lint.

### Environment

Frontend vars live in `.env.local` (see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

The Edge Functions have **separate** secrets, set in the Supabase dashboard, not in `.env.local`:
`SPOTIFY_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (used by `spotify-playlist`, the
catalog metadata fetch), and `YOUTUBE_API_KEY` (used by `youtube-match`, the video lookup — a
static key from a Google Cloud project with the YouTube Data API v3 enabled, no refresh flow
needed). No frontend Spotify credentials exist anymore: the catalog fetch has always run
server-side, with no per-user login involved.

---

## Architecture

Dependencies flow one way. Components stay presentational; they receive data and callbacks as props.

```
pages/  →  hooks/  →  lib/{lobbies,spotify,youtube,scoring}  →  lib/supabaseClient
                ↘  components/  (presentational only)
```

| Path | Responsibility |
| --- | --- |
| `src/pages/` | `Home`, `Game`. Routes are declared in `App.tsx`. |
| `src/hooks/` | Stateful glue: `useLobbyRealtime`, `useGameActions`, `useYoutubePlayer`, `useYoutubePlayback`, `useRoundLifecycle`, `useAnswerChime`, `useMusicQueue`, `usePlayerIdentity`, plus the form hooks. |
| `src/lib/lobbies/` | **Every** Supabase read and write, split by concern. `rowOperations.ts` holds the shared read-modify-write plumbing, including `regenerateMusicQueue`. |
| `src/lib/scoring/` | Pure grading logic. No imports outside `types`. |
| `src/lib/playback/` | Pure round clock (`elapsedMs`, `remainingSeconds`) and `resolvePlaybackIntent`. No imports outside `types`. Backend-agnostic — it derives an intent from an opaque track id, and doesn't care whether that id is a Spotify track or a YouTube video. |
| `src/lib/spotify/` | `playlist` (Edge Function call for catalog metadata) — that's all that's left. Playback used to live here too; see "Playback: YouTube, not Spotify" below. |
| `src/lib/youtube/` | `search` (Edge Function call to match a track to a video id), `player` (loads the IFrame API, creates a `YT.Player`). |
| `src/types/index.ts` | All shared types. Naming convention is `somethingProps`. |
| `src/constants/createGameOptions.ts` | Playlists, game modes, question text, duration bounds. |
| `supabase/` | `schema.sql` and two Edge Functions: `spotify-playlist` (catalog metadata) and `youtube-match` (video lookup). |

Routes: `/` · `/create` · `/join` · `/game/:code`.

### `Game.tsx` is composition only

The page holds no game logic. It resolves the lobby, derives the host role, calls five hooks
and renders four children — nothing else. Each hook owns one concern and one set of invariants:

| Hook | Owns |
| --- | --- |
| `useLobbyRealtime` | The row, plus `notFound` / `kicked`. |
| `useGameActions` | Every user-initiated mutation, and the presence subscription. |
| `useYoutubePlayback` | Driving this tab's YouTube player from the row (`appliedRef`) — runs for every player, not just the host. |
| `useRoundLifecycle` | The round clock and the payout (`finalizeRound`, `roundFinalizedRef`). |
| `useAnswerChime` | The pop sound when one more player answers. |

Children: `GameStage` (the `<main>`, swapped for `PodiumStage` once the game is `ended`),
`GameFooter` (controls), `PlayersModal`, `SettingsModal`. None of them import from `lib/` — if a
control needs a mutation, add it to `useGameActions` and pass the handler down.

---

## The single source of truth: one `lobbies` row

**The entire game state lives in one Postgres row.** There is no server-side game logic — every
client mirrors that row over Supabase Realtime and the clients themselves decide what to write.

```
lobbies
  code           text unique   -- 4-digit, generated by codeGenerator.ts
  password_hash  text          -- bcrypt, checked client-side in useJoinGameForm
  is_public      boolean
  category       jsonb         -- the chosen Spotify playlist { value, label }
  game_state     jsonb         -- gameStateProps: status, mode, questionMode, round, duration,
                               --   roundStartedAt/pausedElapsedMs (the round clock)…
  players        jsonb         -- playerProps[]: id, pseudo, host, score, answer, roundPoints…
  music_queue    jsonb         -- playlistQueueProps: { items, current } — `current` is written
                               --   only by startRound, derived from game_state.round
```

Four consequences that matter every time you touch this:

1. **`rowToLobby` (`src/lib/lobbies/mappers.ts`) is the only DB→app boundary, and it renames
   fields.** `is_public` → `public`, `code` → `generatedCode`, `players` → `player` (singular, but
   it is an array). Always convert at that boundary; never pass a raw row into the UI.

2. **Every mutation is a read-modify-write on jsonb, so concurrent writers clobber each other.**
   `findLobbyRowByCode` → mutate in JS → `update`. Two clients doing this at once means one write
   is silently lost. This is *the* reason several operations are host-only.

3. **RLS is wide open.** Anyone holding the anon key can read, insert, update or delete any lobby.
   This is prototype-grade and documented as such in `schema.sql`. Note that a blocked delete looks
   identical to a successful one, which is why `deleteLobby` checks the returned `count`.

4. **`replica identity full` is set** so DELETE realtime events carry every column — otherwise a
   `filter: code=eq.xxxx` on DELETE would never match and clients would never learn the lobby closed.

A second table, `spotify_catalog_token`, has RLS enabled with **no policies**, making it reachable
only by the Edge Function's service-role key.

---

## Game loop

```
waiting  ──start──►  playing  ◄──resume/pause──►  paused
   ▲                    │
   │                 round ends
   │                    ▼
   │                finished  ──new round──►  playing
   │                    │
   │              (that was the last round)
   │                    ▼
   └──nouvelle partie── ended
```

The status lives in `game_state.status` (`GameStatus` in `src/types/index.ts`).

**Host presses a button** → `hostActionByStatus` (`src/hooks/useGameActions.ts`) maps the
current status to a handler. Starting the game and starting the next round are the **same
operation**, `startRound`.

**`finished` on the last round leads to `ended`, not to another round.** `isFinalRound`
(`src/util/index.ts`) answers "was that the last one?", and `hostActionByStatus` swaps
`startRound` for a write of `GameStatus.Ended`; `HostActionButton` relabels itself "Voir le
classement final". Without that swap `startRound` would run past the end of the queue and
`current = Math.min(round, items.length - 1)` would replay the final track forever. The check is
bounded by the **queue length as well as `totalRounds`**, for the case where the playlist yielded
fewer tracks than the host asked for.

`ended` is a status in the row rather than local state precisely because every client has to reach
the podium together; nothing else can write it, so `useLobbyRealtime`'s "back to `waiting` means a
restart" assumption still holds. It resolves to the **`pause`** intent — unlike `finished`, the
game is over and the music should stop. `Game.tsx` renders `PodiumStage` instead of `GameStage`
while it is set, and `GameFooter` withholds both the host action and "relancer la partie" so the
podium owns the single call to action. That button is gated on **`isHostPlayer`**: restarting
writes settings, it is not playback.

**`startRound` is one atomic write.** Cleared answers, the question, `round`, `status`, the round
clock and `music_queue.current` all go out in a single `update`. Two rules hold it together:

- **`current` is derived from `round`, never incremented.** It used to be advanced from
  the page by *every* client, so N browsers each ran a read-modify-write on `music_queue`
  from their own snapshot — a single stale writer skipped a track (or rewound the queue) for
  everyone, permanently, since the queue holds exactly `totalRounds` items.
- **Clients never see a half-started round.** This was four sequential writes, so `playing`
  arrived before the new track and the countdown started a round-trip ahead of the audio.

**The countdown is derived, not decremented.** `game_state.roundStartedAt` is the epoch ms at
which the round's track should be at position 0; every client computes
`remainingSeconds` (`src/lib/playback/`) against it, so nobody drifts and a mid-round refresh
lands on the right second. `pauseRound` freezes the elapsed time into `pausedElapsedMs`;
`resumeRound` rewinds `roundStartedAt` by it, so paused time never counts.

The one trade-off: the timestamp comes from the writing client's `Date.now()`, so a player
whose system clock is badly skewed sees a skewed countdown. Values are clamped to
`[0, duration]`, so it degrades rather than breaking.

**Only the host ends the round.** Scoring reads and rewrites the whole `players` array, so if
each browser did it they would race each other into clobbering scores. Non-host clients just
sit at 0 and wait for the realtime update. This lives in `useRoundLifecycle`, gated on
`isHostPlayer`.

Two things can end a round, and both funnel through `finalizeRound`:
- the countdown reaching 0
- every player having answered — no reason to run the clock down

Double-payout is guarded twice: `roundFinalizedRef` in `useRoundLifecycle`, and a
`status === Finished` check inside `finishRound`. The ref is deliberately a **boolean flag, not a
round number** — "relancer la partie" resets `round` to 0, and a remembered number would then match
the new game's first round and block it from ever ending.

`finalizeRound` keeps **empty `useCallback` deps** and reads the track from `roundTrackRef`. It is a
dependency of both round-ending effects, so a new identity per queue update would re-run them. The
ref is not redundant just because `currentTrack` is a hook parameter.

`finishRound` writes scores **and** status in a single update, so the reveal never appears with the
previous round's points still on screen.

**The track keeps playing through the reveal.** `finished` resolves to the `idle` intent, not
`pause` — players get to hear the song they were guessing at. It has to be `idle` rather than a
`play`: by then `elapsedMs` has run past the round duration and keeps growing, so re-issuing a
position would seek past the end of the track. The next `startRound` replaces it, and "relancer la
partie" (→ `waiting`) stops it.

### `mode` vs `questionMode`

`game_state` carries both, and the difference is load-bearing:

- `mode` — what the host configured (may be `random`).
- `questionMode` — what *this* round actually asks about.

They are identical except under `Aleatoire`, where `resolveGameQuestion` (`src/util/index.ts:58`)
draws a mode per round. **Both must be persisted**: only the question *text* is stored otherwise,
and the scorer cannot grade an answer from text alone. `Titre` and `Album` are excluded from random
draws (`RANDOM_MODE_EXCLUSIONS`) because one only works on soundtrack playlists and the other is
unscored — landing on either would hand players an unwinnable round.

---

## Scoring (`src/lib/scoring/`)

Pure and dependency-free. If tests are ever added, start here — it is the one part of the app that
is trivially unit-testable.

**Points** (`points.ts`):

| Mode | Exact | Closest |
| --- | --- | --- |
| Année | 15 | 7 |
| Musique | 10 | — |
| Titre | 10 | — |
| Artiste | 8 | — |
| Décennie | 5 | 3 |
| Album | **0** | — |

`Album` is **deliberately unscored** — absence from `MODE_POINTS` means zero points, not a bug.

**Numeric modes** (`Année`, `Décennie`) are graded across the whole table at once, not per player:
if anyone hits it exactly, the closest-guess consolation is cancelled for everyone else.
Unparseable answers sit the round out rather than counting as infinitely distant.

**Text modes** go through `normalizeText` (`normalize.ts`), which strips Spotify decoration players
never hear — `- Remastered 2011`, `(feat. X)`, `(From "Shrek")` — plus accents, punctuation and
leading articles, then compares with hand-rolled Levenshtein at `similarity >= 0.85`.

Two things not to "fix":

- **`expectedAnswer` shares its per-mode switch with the scorer on purpose**, so the answer shown
  during the reveal can never drift from the one that was actually graded. Keep them together.
- **`parseReleaseYear` slices the string instead of using `new Date()`.** A date-only string parses
  as UTC midnight, which `getFullYear()` renders in local time — `"1984-01-01"` reads back as 1983
  anywhere west of Greenwich.

---

## Playback: YouTube, not Spotify

Audio used to play through the Spotify Web Playback SDK in exactly one browser tab — the host's.
That had three hard problems: only one device ever produced sound (so "anyone can host" never
meant "everyone hears the music" unless they shared a room), iOS Safari doesn't support the SDK at
all, and there's no way to relay Spotify audio from a server — the Web API/SDK never expose a raw
stream. YouTube IFrame embeds need no per-user login, so **every client runs its own player and
produces its own audio locally** — no server relay, and no Spotify auth anywhere in the frontend
anymore.

**Spotify is metadata-only now.** `src/lib/spotify/playlist.ts` (`fetchPlaylistTracks`) still calls
the `spotify-playlist` Edge Function for title/artist/release date/album/cover — nothing about that
pipeline changed, and `src/lib/scoring/` still grades off it exactly as before. What changed is
*what plays*: `regenerateMusicQueue` (`src/lib/lobbies/rowOperations.ts`) additionally calls
`matchYoutubeVideos` (`src/lib/youtube/search.ts` → the `youtube-match` Edge Function) to attach a
`youtubeIds: string[]` list of candidate videos to each track before writing the queue. A track with
no surviving candidate at all is dropped rather than queued unplayable, which is why the fetch asks
Spotify for `rounds * 1.3` tracks instead of exactly `rounds`; a queue that still comes up short of
`totalRounds` is already a handled case (`isFinalRound` is bounded by queue length, see the Game
loop section).

**Matching is two-stage, because the search endpoint's embeddability flag is a hint, not a fact.**
`youtube-match` first calls `search.list` with `videoEmbeddable=true` for up to 8 raw candidates per
track, then verifies every candidate across the whole batch in one (or a few, chunked at 50 ids)
`videos.list?part=status` call and keeps only the ones whose *current* `status.embeddable` is
actually `true` — the search index lags behind a video's real, live embed status, which is exactly
what used to surface as "cette vidéo ne peut pas être lue ici" despite the search filter already
being on. The `videos.list` verification costs 1 quota unit per up-to-50 ids, negligible next to the
100 units per search call. Up to `VERIFIED_CANDIDATES_PER_TRACK` (5) survivors are kept per track, in
original search-relevance order — `musicItemsProps.youtubeIds` carries that whole list, not just a
single winner, precisely so a bad pick isn't a dead end.

**Neither API call in `youtube-match` swallows its own errors, on purpose.** Both `searchVideoIds`
and `fetchEmbeddableIds` only throw on an HTTP-level failure (quota exhausted, bad key), never on a
genuine empty result — an early version caught those per-track/per-chunk and treated them as "no
match," which made a systemic failure (quota exceeded on every call) indistinguishable from "this
whole playlist has no YouTube matches": `regenerateMusicQueue` silently wrote an empty
`music_queue.items` with no error anywhere. Letting a real API failure fail the whole request (500,
surfaced as "Impossible de créer le lobby" client-side) is worse UX for a transient blip but is what
makes a systemic problem loud enough to actually notice and debug.

**`isHost` doesn't exist anymore — there's only `isHostPlayer`.** Playback needing "a connected
Spotify account" was the entire reason for that split; with no device and no login, the host flag
alone gates everything the old `isHost` did (playback controls, volume, settings panel, skip/restart)
same as it already gated scoring and kick/promote. If you find yourself wanting to reintroduce a
narrower "is this browser capable of X" flag for playback, that's very likely the same bug this
section used to warn about, just inverted.

**No cross-page singleton, on purpose.** The Spotify device used to live in a module-level store
outliving any single page, because recreating the SDK player raced Spotify's backend teardown of
the previous device. A `YT.Player` has no server-side device to race — `useYoutubePlayer` owns a
plain component-scoped ref, created while `enabled` and destroyed on unmount. Simpler by
construction, not by omission.

**Every player runs its own reconciler.** `useYoutubePlayer({ enabled: true })` is still called
unconditionally in `Game.tsx` for *every* player (not gated on host), same as the old Spotify
pre-warm — except now every tab's player actually produces audio, not just the host's.
`useYoutubePlayback` applies `resolvePlaybackIntent` (`src/lib/playback/`, unchanged — it already
took an opaque track id and doesn't care whether that id is a Spotify track or a YouTube video, so it
takes the *first* candidate purely as a stable identity for its own `appliedRef` dedup, not
necessarily the one that ends up playing) against that player, using `appliedRef` to dedupe identical
intents exactly like the old `useHostPlayback` did. What's gone is the host-handoff bookkeeping
(`wasHostPlayerRef`, `wasHostWithDeviceRef`): since every client reconciles independently against the
same row instead of one client inheriting another's device state, there's no "did this browser ever
populate `appliedRef`" question to answer anymore.

**A track's candidates are a runtime fallback chain, not just a matching-time list.**
`useYoutubePlayer` keeps its own `attemptRef` (candidates, current index, position) separate from
`useYoutubePlayback`'s `appliedRef`. When the player's `onError` fires — a candidate that passed
`videos.list` verification can still fail live (geo-restriction, a claim landing after the check) —
the hook silently advances to the next candidate and retries, and only surfaces a toast once every
candidate in the list is exhausted. `useYoutubePlayback` never sees this happen: `resume()` resolves
once it *starts* an attempt, not once one actually succeeds, so the reconciler's job stays "kick off
playback for this track once" regardless of how many candidates it takes underneath.

**Resume-in-place mirrors the old Spotify behavior, for the same reason.** `useYoutubePlayer.resume`
checks whether the player already holds the requested video id; if so it just calls `playVideo()`
without seeking, instead of reloading at the freshly computed position. This isn't optional
politeness — `resumeRound` rewinds `roundStartedAt` by `pausedElapsedMs` so the newly computed
position matches wherever playback was paused, and an unconditional seek-on-resume would be
redundant at best and a stutter at worst.

**The audio-unlock gesture is new, and is the one thing YouTube needs that Spotify didn't.**
Browsers (iOS Safari in particular) only allow the *first* play to start inside a user-gesture call
stack — and it has to be a real play of real content: calling `playVideo()`/`pauseVideo()` on a
player with nothing cued doesn't "prime" anything, it just throws the same "invalid parameter" error
as any other call with no video loaded. So `unlock(candidates, positionSeconds)` **is** the round's
actual first playback attempt, not a separate step — it's exactly `resume()` under the hood, marking
`isUnlocked` first. `Game.tsx` only offers this once one exists: `canUnlock` is
`resolvePlaybackIntent(gameState, currentTrack?.youtubeIds[0]).kind === "play"`, computed fresh on
every render so the click always acts on "now," never a stale render's position. `GameFooter`'s
volume slot reflects three states, not two: nothing while `!canUnlock` (no track to unlock with
yet — typically `waiting`/`paused`), the "Activer le son" `IconButton` while `canUnlock &&
!isUnlocked`, and `YoutubeVolumeControl` once `isUnlocked`. `useYoutubePlayback` early-returns while
`!isUnlocked` — skip this gate and playback silently never starts on strict browsers instead of
erroring loudly.

**A fresh page load always needs one click, and that's not fixable from here.** Every full reload
resets the browser's own "has this frame seen a user gesture" state, YouTube embeds included —
no amount of client-side bookkeeping (a stored flag, a prior session's unlock) changes what the
browser itself remembers after a reload, because the permission is enforced by the browser process,
not by anything this app controls. What *is* fixable, and was the actual bug: the click used to throw
immediately because it primed an empty player instead of loading the real track, so it looked broken
rather than just "needs the one click every fresh load genuinely needs."

**Host handoff still freezes the round clock.** `promotePlayer` still force-pauses a `playing` game
and freezes `pausedElapsedMs` on handoff — that part didn't change, because the round clock lives in
the row regardless of what's driving playback. What it no longer needs to reason about is a device:
every client, promoted host or not, was already running its own reconciler against the same row.
Disconnects that skip the normal leave path (closed tab, crash, lost network) are still caught by
Supabase presence in `useGameActions`; `pickSuccessorPlayer` still picks deterministically (lowest
id) so exactly one client acts without coordination.

**YouTube Data API quota is a known, accepted constraint, not a bug to fix here.** Each
`youtube-match` call spends 100 quota units per track searched (10k/day free tier ⇒ roughly 3–5 full
queue builds/day). Fine for a private, friends-only game; a future cache of
`spotify track id → youtube id` in Postgres would remove repeat lookups if that ever gets tight.

---

## Conventions

**Types.** `somethingProps` naming. Enums are const objects plus a derived union, never TS `enum`:

```ts
export const GameStatus = { Waiting: "waiting", /* … */ } as const;
export type GameStateEnum = (typeof GameStatus)[keyof typeof GameStatus];
```

`verbatimModuleSyntax` is on, so type-only imports **must** use `import type`.

**Formatting.** Tabs for indentation. Double quotes in `.ts`/`.tsx` code, single quotes for JSX
attributes (`className='…'`).

**Styling.** Tailwind v4 with design tokens declared in `@theme` in `src/index.css`:
`bg-deep`, `purple`, `purple-light`, `purple-soft`, `accent-blue`, `lavender`, and the
`font-display` / `font-body` families. **Use the tokens, never raw hex.** Opacity modifiers
(`text-lavender/68`, `bg-lavender/5`) are the house style for surfaces and muted text.

Four `@utility` classes in the same file carry the strings that repeat across components — reach
for these before pasting a long `className`:

| Utility | Where |
| --- | --- |
| `glass-panel` | Every bordered translucent surface (answer box, settings panel, scoreboard, avatar strip). |
| `field-input` | Text/select inputs. **Surface and focus ring only** — padding and font size stay per-site, because 4 of the 5 call sites differ and overriding a custom utility depends on emitted-CSS order, not the order you write the classes. |
| `field-label` | Form field labels. |
| `control-shell` | The bordered box around a toggle or slider. |

**Shared UI.** Buttons come from `src/components/Button.tsx`: `PrimaryButton`, `SecondaryButton`,
and `IconButton` for square icon-only controls (it takes `label` — used as both `aria-label` and
`title` — plus `icon`). Don't hand-roll one. `DurationSlider` is the shared extract-length control;
give each call site a distinct `id`. Icons are inline SVG components in `src/components/icons/`.

**Modals** portal into `#modal-root` (declared in `index.html`) and handle focus, Escape and
scroll-lock themselves. `Modal.tsx` also exports `ModalHeader` (title + close), `ModalBody` (the
scrolling region) and `ModalCloseButton` — compose those rather than rebuilding the chrome.

**Toasts.** `showToast(text, variant)` from `src/lib/toast.ts`, variants `join | leave | closed | error`.

**Commits.** History uses a `[FEAT]` / `[FIX]` prefix; subjects are often French.

---

## Gotchas

- **Import from the `lib/lobbies` barrel.** It re-exports everything callers need, including
  `promotePlayer`, `updatePlayerAnswer` and `updateGameSettings`. `rowToLobby` and the
  `rowOperations` helpers stay internal — deep-import those only from inside `lib/lobbies`.
  `lib/scoring`'s barrel is deliberately narrow (`scoreRound`, `expectedAnswer`,
  `parseReleaseYear`); the normalizer and points tables are internals.

- **Realtime `postgres_changes` filters evaluate against the NEW row on UPDATE.** A public→private
  toggle would never match `is_public=eq.true`, so `subscribeToPublicLobbies` subscribes to *all*
  table changes and re-queries with the filter applied server-side instead.

- **The current player's identity is a `?current=` query param**, read in `Game.tsx`. There is no
  auth — a stale or foreign id is handled by `checkStillMember` in `useLobbyRealtime`, which treats
  "not in the players array" as kicked.

- **`createGameOptions.ts`** contains a `"Test"` playlist marked `// remove in production`.
  `TITLE_ONLY_PLAYLISTS` in the same file lists the soundtrack playlists that offer only `Titre`,
  keyed by playlist id — `filterGameModesForCategory` (`src/util/`) reads it. This replaced two
  copies of a check against magic indices `musicStyle[3]` / `musicStyle[4]`.

- **Read-modify-write races** — see the lobby row section above. `updateLobbyRow`
  (`lib/lobbies/rowOperations.ts`) removes the boilerplate but **does not** make the write atomic.
  Before adding a mutation, ask which clients can call it concurrently. The queue-advance bug is the
  cautionary tale: an innocuous `current + 1` in a `useEffect` ran on every client at once.

- **Don't split a round transition into several writes.** Every `update` is its own realtime
  broadcast, so N writes means N renders on every client, each seeing a partial state.
  `updateRound` / `updateGameQuestion` / `resetPlayerAnswer` were removed for this reason —
  `startRound` replaces all three.

- **`LobbyQuestionBox` is mounted twice, and that is on purpose.** The desktop copy lives in the
  `hidden lg:flex` left column; a second `compact` copy sits above the album art under `lg:hidden`,
  because the left column simply does not render on a phone and mobile players had no way to
  answer at all. Both are in the DOM at once, so each call site passes its own `inputId` — don't
  let them share one. `GameStage` hides `PlayerAvatarList` on mobile for exactly the statuses where
  the answer box shows (`playing` / `paused` / `finished`); the two don't fit above the cover, and
  `waiting` keeps the strip since that's the lobby view. `compact` is not a mobile flag — the
  desktop copy takes it too while the settings panel is expanded, which is why
  `LobbySettingsPanel` is **controlled** from `GameStage` rather than holding its own `isOpen`.

- **Mobile scrolls the stage and the footer together.** No phone fits a whole round, so `Game.tsx`
  wraps the stage and `GameFooter` in one `overflow-y-auto` column — the "Quitter la partie" button
  scrolls into view rather than being pinned over the content. That wrapper is `lg:contents`, which
  dissolves it on desktop so `main` and `footer` are direct children of `PageBackground` again;
  correspondingly the stages carry `lg:min-h-0`, not `min-h-0`, since on mobile they must take
  their content's height and let the wrapper scroll. `PageBackground` stays `h-dvh
  overflow-hidden` at every width — it clips the drifting background blobs, and letting *it*
  scroll would make their negative offsets part of the scrollable area.

- **`rankPlayers` (`src/util/`) returns the pre-sort index as `toneIndex`.** `PlayerAvatar` picks
  its gradient from it, so a player keeps the same colour as the standings move. Don't re-derive it
  by sorting and then `findIndex`-ing back.

- **One pre-existing lint error**, in `LobbyQuestionBox.tsx` (`react-hooks/set-state-in-effect`:
  clearing the answer on a new round). It predates this refactor; `npm run lint` reporting exactly
  one problem is the clean baseline.

---

## Current state

`TODO.MD` is the live roadmap — check it rather than trusting this section to stay current.

One thing is unfinished and should **not** be mistaken for a bug:

- **`Album` mode awards no points** (deliberately absent from `MODE_POINTS`).

One known race is **deliberately left open**: the skip button calls `finishRound` directly without
setting `roundFinalizedRef`, so a countdown reaching 0 just before the realtime update lands can
attempt a second payout. Only the server-side `status === Finished` guard stops it, and that is a
read-then-write. Routing skip through `finalizeRound` would close it.
