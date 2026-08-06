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
	volume: number,
): Spotify.Player {
	return new window.Spotify.Player({
		name: "Bludster",
		getOAuthToken,
		volume,
	});
}

class SpotifyPlaybackError extends Error {}

const TRANSIENT_RETRY_STATUSES = new Set([403, 404]);
const MAX_TRANSIENT_RETRIES = 4;
const TRANSIENT_RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callPlayerEndpoint(
	path: string,
	deviceId: string,
	accessToken: string,
	body?: object,
): Promise<void> {
	const url = new URL(`https://api.spotify.com/v1/me/player/${path}`);
	url.searchParams.set("device_id", deviceId);

	for (let attempt = 0; ; attempt++) {
		const response = await fetch(url, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		// 204 No Content on success.
		if (response.ok || response.status === 204) return;

		const text = await response.text();

		// A device_id fresh from the Web Playback SDK's "ready" event can take
		// a moment to be registered as controllable on Spotify's backend, which
		// surfaces as a transient 403 "Restriction violated" (or 404) right
		// after connecting. Retry that window instead of failing immediately.
		// PREMIUM_REQUIRED 403s are a real, permanent rejection, so exclude them.
		const isTransient =
			TRANSIENT_RETRY_STATUSES.has(response.status) &&
			!text.includes("PREMIUM_REQUIRED");

		if (isTransient && attempt < MAX_TRANSIENT_RETRIES) {
			await sleep(TRANSIENT_RETRY_DELAY_MS * (attempt + 1));
			continue;
		}

		throw new SpotifyPlaybackError(
			`Spotify playback request failed (${response.status}): ${text}`,
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

export function pausePlaybackOnDevice(
	deviceId: string,
	accessToken: string,
): Promise<void> {
	return callPlayerEndpoint("pause", deviceId, accessToken);
}

/** Resumes from the current paused position instead of restarting the track. */
export function resumePlaybackOnDevice(
	deviceId: string,
	accessToken: string,
): Promise<void> {
	return callPlayerEndpoint("play", deviceId, accessToken);
}
