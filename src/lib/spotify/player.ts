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

class AbortedError extends Error {}

/**
 * Whether a rejection is just "a newer command for this device took over".
 * Callers should stay quiet about those — the supersession was deliberate, and
 * the command that replaced it reports its own outcome.
 */
export function isPlaybackAborted(error: unknown): boolean {
	return (
		error instanceof AbortedError ||
		(error instanceof DOMException && error.name === "AbortError")
	);
}

/** Rejects with `AbortedError` as soon as `signal` fires, instead of sleeping it out. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);

		function onAbort() {
			clearTimeout(timeoutId);
			reject(new AbortedError());
		}

		signal.addEventListener("abort", onAbort, { once: true });
	});
}

// Spotify Connect applies one command at a time per device, and a command that
// arrives while the previous one is still settling comes back as
// 403 "Restriction violated". Chaining every request for a device keeps them in
// the order they were issued and — since a request can spend seconds in the
// retry loop below — stops a stale command from landing after a newer one.
const deviceQueues = new Map<string, Promise<unknown>>();

// Latest intent wins. A command stuck in the retry loop below can hold its
// device for seconds while the round runs on, and whatever it eventually
// achieves is already out of date — the newer command is the one that reflects
// the game. Aborting the older one frees the queue immediately and, for two
// `play`s in a row, stops the older track from being audible at all.
const deviceAborts = new Map<string, AbortController>();

function enqueue<T>(
	deviceId: string,
	task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	deviceAborts.get(deviceId)?.abort();
	const controller = new AbortController();
	deviceAborts.set(deviceId, controller);

	const previous = deviceQueues.get(deviceId) ?? Promise.resolve();
	const run = () => task(controller.signal);
	// Runs on both settle paths: one failed command must not strand the queue.
	const settled = previous.then(run, run);
	deviceQueues.set(
		deviceId,
		settled.catch(() => undefined),
	);
	return settled;
}

// Keyed by `command:deviceId` so an overlapping call for the same command
// (e.g. two effect runs triggered in quick succession by unrelated realtime
// updates, or React StrictMode's dev-only double-invoke) reuses the request
// already in flight instead of firing a second one and doubling any error.
// The key is the command rather than the endpoint: "start this track" and
// "resume" share the /play path but are different intents, and collapsing one
// into the other silently drops it.
const inFlightRequests = new Map<string, Promise<void>>();

function callPlayerEndpoint(
	command: string,
	path: string,
	deviceId: string,
	accessToken: string,
	options: { retries: number; body?: object },
): Promise<void> {
	const key = `${command}:${deviceId}`;
	const existing = inFlightRequests.get(key);
	if (existing) return existing;

	const request = enqueue(deviceId, (signal) =>
		sendPlayerRequest(path, deviceId, accessToken, signal, options),
	).finally(() => inFlightRequests.delete(key));
	inFlightRequests.set(key, request);
	return request;
}

async function sendPlayerRequest(
	path: string,
	deviceId: string,
	accessToken: string,
	signal: AbortSignal,
	{ retries, body }: { retries: number; body?: object },
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
			signal,
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

		if (isTransient && attempt < retries) {
			await sleep(TRANSIENT_RETRY_DELAY_MS * (attempt + 1), signal);
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
	// Per track: two different tracks are two different intents, and only a
	// repeat of the same one is safe to collapse.
	return callPlayerEndpoint(`play:${trackId}`, "play", deviceId, accessToken, {
		// Worth waiting out the "not yet controllable" window: without this the
		// round has no audio at all.
		retries: MAX_TRANSIENT_RETRIES,
		body: {
			uris: [`spotify:track:${trackId}`],
			position_ms: positionMs,
		},
	});
}

/** Fallback for when the SDK has no local state — prefer `pauseLocalPlayback`. */
export function pausePlaybackOnDevice(
	deviceId: string,
	accessToken: string,
): Promise<void> {
	// No retries: reaching here means the SDK reported nothing playing locally,
	// so a 403 almost certainly means there was nothing to pause. Retrying it
	// would block the device queue for seconds over a command that doesn't
	// matter, delaying the next track.
	return callPlayerEndpoint("pause", "pause", deviceId, accessToken, {
		retries: 0,
	});
}

// There is deliberately no `resumePlaybackOnDevice`. `PUT /play` with no body
// asks a device to resume the context it already holds, so it only ever worked
// on a device the SDK could have resumed locally anyway — and on one that holds
// nothing (a host promoted mid-game) it is a guaranteed
// `403 Restriction violated`. Callers start the track at the round's position
// instead; see `useSpotifyPlayer.resume`.
