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
	pauseLocalPlayback,
	reportSpotifyPlayerError,
	resumeLocalPlayback,
	setSpotifyPlayerVolume,
	subscribeSpotifyPlayer,
} from "../lib/spotify/playerStore";

interface UseSpotifyPlayerOptions {
	enabled: boolean;
}

const NOT_READY_MESSAGE =
	"Lecteur Spotify pas encore prêt, réessaie dans un instant.";

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

	/** Resolves to whether the track actually started. */
	const play = useCallback(
		async (trackId: string, positionMs = 0): Promise<boolean> => {
			if (!deviceId) {
				reportSpotifyPlayerError(NOT_READY_MESSAGE);
				return false;
			}
			try {
				await playTrackOnDevice(deviceId, trackId, await getHostAccessToken(), positionMs);
				return true;
			} catch (err) {
				reportSpotifyPlayerError((err as Error).message);
				return false;
			}
		},
		[deviceId],
	);

	const pause = useCallback(async () => {
		if (!deviceId) {
			reportSpotifyPlayerError(NOT_READY_MESSAGE);
			return;
		}
		try {
			if (await pauseLocalPlayback()) return;
			// No local state: Spotify doesn't consider us the playing device.
			// Ask the API anyway in case the SDK simply lost track of it, but
			// there is nothing to interrupt, so a rejection isn't worth a toast.
			await pausePlaybackOnDevice(deviceId, await getHostAccessToken()).catch(
				(err) => console.warn(err),
			);
		} catch (err) {
			reportSpotifyPlayerError((err as Error).message);
		}
	}, [deviceId]);

	const resume = useCallback(async () => {
		if (!deviceId) {
			reportSpotifyPlayerError(NOT_READY_MESSAGE);
			return;
		}
		try {
			if (await resumeLocalPlayback()) return;
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
