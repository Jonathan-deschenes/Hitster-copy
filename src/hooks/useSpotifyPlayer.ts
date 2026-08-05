import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getHostAccessToken } from "../lib/spotify/auth";
import {
	createSpotifyPlayer,
	loadSpotifySdk,
	pausePlaybackOnDevice,
	playTrackOnDevice,
	resumePlaybackOnDevice,
} from "../lib/spotify/player";

const ERROR_MESSAGES: Record<Spotify.ErrorTypes, string> = {
	account_error: "Compte Spotify Premium requis pour lancer la musique.",
	authentication_error: "Session Spotify expirée, reconnecte le host.",
	initialization_error: "Impossible d'initialiser le lecteur Spotify.",
	playback_error: "Erreur de lecture Spotify.",
};

const ERROR_TYPES = Object.keys(ERROR_MESSAGES) as Spotify.ErrorTypes[];

interface UseSpotifyPlayerOptions {
	enabled: boolean;
}

/**
 * Turns the host's browser into a Spotify Connect device via the Web
 * Playback SDK. No-op (inert) when `enabled` is false — call unconditionally
 * to respect the rules of hooks, gate with `enabled` instead.
 */
export function useSpotifyPlayer({ enabled }: UseSpotifyPlayerOptions) {
	const [deviceId, setDeviceId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const playerRef = useRef<Spotify.Player | null>(null);

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;

		loadSpotifySdk().then(() => {
			if (cancelled) return;

			const player = createSpotifyPlayer((cb) => {
				getHostAccessToken().then(cb);
			});
			playerRef.current = player;

			player.addListener("ready", ({ device_id }) => setDeviceId(device_id));
			player.addListener("not_ready", () => setDeviceId(null));
			for (const errorType of ERROR_TYPES) {
				player.addListener(errorType, () => setError(ERROR_MESSAGES[errorType]));
			}

			player.connect();
		});

		return () => {
			cancelled = true;
			playerRef.current?.disconnect();
			playerRef.current = null;
			setDeviceId(null);
		};
	}, [enabled]);

	const play = useCallback(
		async (trackId: string, positionMs = 0) => {
			if (!deviceId) return;
			try {
				await playTrackOnDevice(deviceId, trackId, await getHostAccessToken(), positionMs);
			} catch (err) {
				setError((err as Error).message);
			}
		},
		[deviceId],
	);

	const pause = useCallback(async () => {
		if (!deviceId) return;
		try {
			await pausePlaybackOnDevice(deviceId, await getHostAccessToken());
		} catch (err) {
			setError((err as Error).message);
		}
	}, [deviceId]);

	const resume = useCallback(async () => {
		if (!deviceId) return;
		try {
			await resumePlaybackOnDevice(deviceId, await getHostAccessToken());
		} catch (err) {
			setError((err as Error).message);
		}
	}, [deviceId]);

	return useMemo(
		() => ({ isReady: deviceId !== null, error, play, pause, resume }),
		[deviceId, error, play, pause, resume],
	);
}
