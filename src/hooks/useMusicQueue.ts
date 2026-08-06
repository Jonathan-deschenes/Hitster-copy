import { useCallback, useMemo } from "react";
import type { musicItemsProps, playlistQueueProps } from "../types";
import { setCurrentTrackIndex } from "../lib/lobbies";

// The queue is generated once at lobby creation and persisted to the
// `lobbies.music_queue` column (see createLobby) — this hook no longer
// fetches Spotify itself, it just derives from the realtime-synced lobby
// row so every client sees the same queue and current track.
export function useMusicQueue(musicQueue?: playlistQueueProps, code?: string) {
	const musics = useMemo<musicItemsProps[]>(
		() => musicQueue?.items ?? [],
		[musicQueue],
	);
	const current = musicQueue?.current ?? 0;

	const incrementCurrentTrackIndex = useCallback(async () => {
		if (!code) return;
		const next = Math.min(current + 1, Math.max(musics.length - 1, 0));
		await setCurrentTrackIndex(code, next);
	}, [code, current, musics.length]);

	return [musics, current, incrementCurrentTrackIndex] as const;
}
