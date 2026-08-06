import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getHostAccessToken } from "../lib/spotify/auth";
import {
	pausePlaybackOnDevice,
	playTrackOnDevice,
	resumePlaybackOnDevice,
} from "../lib/spotify/player";
import {
	ensureSpotifyPlayer,
	getSpotifyPlayerSnapshot,
	reportSpotifyPlayerError,
	setSpotifyPlayerVolume,
	subscribeSpotifyPlayer,
} from "../lib/spotify/playerStore";

interface UseSpotifyPlayerOptions {
	enabled: boolean;
}

/**
 * Attaches to the shared Spotify Connect device (see playerStore.ts) while
 * `enabled`. The device outlives any single page, so switching lobbies
 * doesn't tear down and recreate the connection. Call unconditionally to
 * respect the rules of hooks, gate with `enabled` instead.
 */
export function useSpotifyPlayer({ enabled }: UseSpotifyPlayerOptions) {
	const { deviceId, error, volume } = useSyncExternalStore(
		subscribeSpotifyPlayer,
		getSpotifyPlayerSnapshot,
	);

	useEffect(() => {
		if (enabled) ensureSpotifyPlayer();
	}, [enabled]);

	const play = useCallback(
		async (trackId: string, positionMs = 0) => {
			if (!deviceId) return;
			try {
				await playTrackOnDevice(deviceId, trackId, await getHostAccessToken(), positionMs);
			} catch (err) {
				reportSpotifyPlayerError((err as Error).message);
			}
		},
		[deviceId],
	);

	const pause = useCallback(async () => {
		if (!deviceId) return;
		try {
			await pausePlaybackOnDevice(deviceId, await getHostAccessToken());
		} catch (err) {
			reportSpotifyPlayerError((err as Error).message);
		}
	}, [deviceId]);

	const resume = useCallback(async () => {
		if (!deviceId) return;
		try {
			await resumePlaybackOnDevice(deviceId, await getHostAccessToken());
		} catch (err) {
			reportSpotifyPlayerError((err as Error).message);
		}
	}, [deviceId]);

	return useMemo(
		() => ({
			isReady: deviceId !== null,
			error,
			play,
			pause,
			resume,
			volume,
			setVolume: setSpotifyPlayerVolume,
		}),
		[deviceId, error, play, pause, resume, volume],
	);
}
