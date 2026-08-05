const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

let sdkReadyPromise: Promise<void> | null = null;

/** Injects the Web Playback SDK script once and resolves once it's ready to construct players. */
export function loadSpotifySdk(): Promise<void> {
	if (window.Spotify) return Promise.resolve();

	if (!sdkReadyPromise) {
		sdkReadyPromise = new Promise<void>((resolve) => {
			window.onSpotifyWebPlaybackSDKReady = resolve;

			if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
				const script = document.createElement("script");
				script.src = SDK_SRC;
				script.async = true;
				document.head.appendChild(script);
			}
		});
	}

	return sdkReadyPromise;
}

export function createSpotifyPlayer(
	getOAuthToken: (cb: (token: string) => void) => void,
): Spotify.Player {
	return new window.Spotify.Player({
		name: "Bludster",
		getOAuthToken,
		volume: 1,
	});
}

class SpotifyPlaybackError extends Error {}

async function callPlayerEndpoint(
	path: string,
	deviceId: string,
	accessToken: string,
	body?: object,
): Promise<void> {
	const url = new URL(`https://api.spotify.com/v1/me/player/${path}`);
	url.searchParams.set("device_id", deviceId);

	const response = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	// 204 No Content on success; Spotify returns 403 with reason
	// PREMIUM_REQUIRED when the connected account isn't Premium.
	if (!response.ok && response.status !== 204) {
		throw new SpotifyPlaybackError(
			`Spotify playback request failed (${response.status}): ${await response.text()}`,
		);
	}
}

/** Starting playback with `device_id` in the query also transfers playback to this device. */
export function playTrackOnDevice(
	deviceId: string,
	trackId: string,
	accessToken: string,
	positionMs = 0,
): Promise<void> {
	return callPlayerEndpoint("play", deviceId, accessToken, {
		uris: [`spotify:track:${trackId}`],
		position_ms: positionMs,
	});
}

export function pausePlaybackOnDevice(deviceId: string, accessToken: string): Promise<void> {
	return callPlayerEndpoint("pause", deviceId, accessToken);
}

/** Resumes from the current paused position instead of restarting the track. */
export function resumePlaybackOnDevice(deviceId: string, accessToken: string): Promise<void> {
	return callPlayerEndpoint("play", deviceId, accessToken);
}
