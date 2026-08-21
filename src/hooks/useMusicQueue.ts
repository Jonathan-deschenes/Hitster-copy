import { useMemo } from "react";
import type { playbackTrackProps, playlistQueueProps } from "../types";

// Derived from the realtime-synced lobby row, never fetched here. Read-only on
// purpose: `startRound` owns `current`, because clients incrementing it each
// ran their own read-modify-write and a stale one skipped a track for everyone.
export function useMusicQueue(musicQueue?: playlistQueueProps) {
	const musics = useMemo<playbackTrackProps[]>(
		() => musicQueue?.items ?? [],
		[musicQueue],
	);
	const current = musicQueue?.current ?? 0;

	return [musics, current] as const;
}
