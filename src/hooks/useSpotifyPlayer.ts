import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getHostAccessToken } from "../lib/spotify/auth";
import {
	isPlaybackAborted,
	pausePlaybackOnDevice,
	playTrackOnDevice,
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
				// Superseded by a newer command for this device — the one that
				// replaced it reports its own outcome, so stay quiet.
				if (isPlaybackAborted(err)) return false;
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

	/**
	 * Picks the round's track back up at `positionMs`, whichever state this
	 * device is in. Resolves to whether audio is actually running.
	 *
	 * The track and position are required because "resume" is only meaningful
	 * when *this* device already holds the playback context. A host promoted
	 * mid-game never had one, and asking Spotify to resume nothing is a
	 * guaranteed `403 Restriction violated` — so that case starts the track
	 * instead, at the position the round has actually reached.
	 */
	const resume = useCallback(
		async (trackId: string, positionMs = 0): Promise<boolean> => {
			if (!deviceId) {
				reportSpotifyPlayerError(NOT_READY_MESSAGE);
				return false;
			}
			try {
				// Preferred when it applies: keeps the exact position and costs
				// no Web API call. Only true when this device already holds this
				// track, so a new track always falls through to `play`.
				if (await resumeLocalPlayback(trackId)) return true;
			} catch (err) {
				reportSpotifyPlayerError((err as Error).message);
				return false;
			}
			return play(trackId, positionMs);
		},
		[deviceId, play],
	);

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

/**
 * The memoized handle above. Hooks that receive it must take the **whole**
 * object: a narrowed `{ pause, resume }` literal changes identity every render
 * and would re-run the playback reconciler continuously.
 */
export type spotifyPlayerHandleProps = ReturnType<typeof useSpotifyPlayer>;
