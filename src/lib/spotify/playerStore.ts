import { getHostAccessToken } from "./auth";
import { createSpotifyPlayer, loadSpotifySdk } from "./player";
import { StorageKeys, StorageUtility } from "../../hooks/useStorage";

const ERROR_MESSAGES: Record<Spotify.ErrorTypes, string> = {
	account_error: "Compte Spotify Premium requis pour lancer la musique.",
	authentication_error: "Session Spotify expirée, reconnecte le host.",
	initialization_error: "Impossible d'initialiser le lecteur Spotify.",
	playback_error: "Erreur de lecture Spotify.",
};

const ERROR_TYPES = Object.keys(ERROR_MESSAGES) as Spotify.ErrorTypes[];

const DEFAULT_VOLUME = 0.3;

function readStoredVolume(): number {
	const raw = StorageUtility.getItem<number>(StorageKeys.SPOTIFY_HOST_VOLUME);
	return typeof raw === "number" && raw >= 0 && raw <= 1 ? raw : DEFAULT_VOLUME;
}

type PlayerStoreState = {
	deviceId: string | null;
	error: string | null;
	volume: number;
};

let state: PlayerStoreState = {
	deviceId: null,
	error: null,
	volume: readStoredVolume(),
};
let connectPromise: Promise<void> | null = null;
let player: Spotify.Player | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<PlayerStoreState>) {
	state = { ...state, ...patch };
	for (const listener of listeners) listener();
}

/**
 * Lazily creates one Spotify Connect device for the lifetime of the browser
 * tab, shared across every host page that needs it. Recreating the SDK
 * player per lobby used to race Spotify's backend teardown of the previous
 * device (disconnect on unmount vs. connect on the next mount), which
 * surfaced as spurious 404 "Device not found" errors when hosting back to
 * back lobbies.
 */
export function ensureSpotifyPlayer(): Promise<void> {
	if (!connectPromise) {
		connectPromise = loadSpotifySdk().then(() => {
			player = createSpotifyPlayer((cb) => {
				getHostAccessToken().then(cb);
			}, state.volume);

			player.addListener("ready", ({ device_id }) =>
				setState({ deviceId: device_id, error: null }),
			);
			player.addListener("not_ready", () => setState({ deviceId: null }));
			for (const errorType of ERROR_TYPES) {
				player.addListener(errorType, () =>
					setState({ error: ERROR_MESSAGES[errorType] }),
				);
			}

			player.connect();
		});
	}
	return connectPromise;
}

/**
 * Pause/resume through the SDK's own transport controls, which act on what
 * this device is really doing: pausing something already paused — or resuming
 * something already playing — does nothing, where the Web API answers the same
 * command with `403 Player command failed: Restriction violated`.
 *
 * Both return false when the SDK holds no state for this device (Spotify isn't
 * playing through us), leaving the caller to decide whether the Web API is
 * still worth a try.
 */
export async function pauseLocalPlayback(): Promise<boolean> {
	const playbackState = await player?.getCurrentState();
	if (!playbackState) return false;
	if (!playbackState.paused) await player?.pause();
	return true;
}

export async function resumeLocalPlayback(): Promise<boolean> {
	const playbackState = await player?.getCurrentState();
	if (!playbackState) return false;
	if (playbackState.paused) await player?.resume();
	return true;
}

export function reportSpotifyPlayerError(message: string) {
	setState({ error: message });
}

/** Applies and persists the host's volume preference for this browser. */
export function setSpotifyPlayerVolume(volume: number) {
	const clamped = Math.min(1, Math.max(0, volume));
	StorageUtility.setItem(StorageKeys.SPOTIFY_HOST_VOLUME, clamped);
	setState({ volume: clamped });
	player?.setVolume(clamped);
}

export function subscribeSpotifyPlayer(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getSpotifyPlayerSnapshot(): PlayerStoreState {
	return state;
}
