import { useMemo } from "react";
import type { musicItemsProps, playlistQueueProps } from "../types";

// The queue is generated once at lobby creation and persisted to the
// `lobbies.music_queue` column (see createLobby) — this hook no longer
// fetches Spotify itself, it just derives from the realtime-synced lobby
// row so every client sees the same queue and current track.
export function useMusicQueue(musicQueue?: playlistQueueProps) {
	const musics = useMemo<musicItemsProps[]>(
		() => musicQueue?.items ?? [],
		[musicQueue],
	);
	const current = musicQueue?.current ?? 0;

	return [musics, current] as const;
}
