import { useMemo } from "react";
import type { musicItemsProps, playlistQueueProps } from "../types";

// The queue is generated once at lobby creation and persisted to the
// `lobbies.music_queue` column (see createLobby) — this hook no longer
// fetches Spotify itself, it just derives from the realtime-synced lobby
// row so every client sees the same queue and current track.
//
// Read-only on purpose. `current` is advanced server-side by `startRound`,
// which derives it from `game_state.round` in the same write. Letting clients
// increment it meant every browser ran its own read-modify-write on the same
// jsonb column, and a single stale one skipped a track for everyone.
export function useMusicQueue(musicQueue?: playlistQueueProps) {
	const musics = useMemo<musicItemsProps[]>(
		() => musicQueue?.items ?? [],
		[musicQueue],
	);
	const current = musicQueue?.current ?? 0;

	return [musics, current] as const;
}
