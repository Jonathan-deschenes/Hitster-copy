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

/**
 * Skips the notify when nothing changed. `useSyncExternalStore` compares
 * snapshots by identity, so a new object every time re-rendered every consumer
 * and re-ran the playback effect — and re-reporting the same error is common.
 */
function setState(patch: Partial<PlayerStoreState>) {
	const next = { ...state, ...patch };

	const unchanged = (Object.keys(next) as (keyof PlayerStoreState)[]).every(
		(key) => next[key] === state[key],
	);
	if (unchanged) return;

	state = next;
	for (const listener of listeners) listener();
}

/**
 * Lazily creates one Spotify Connect device for the lifetime of the browser
 * tab, shared across every page. Recreating it per lobby raced Spotify's
 * teardown of the previous device and surfaced as spurious 404 "Device not
 * found" when hosting back-to-back lobbies.
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
 * SDK transport controls act on what the device is really doing, so a no-op is
 * harmless — the Web API equivalents answer with `403 Restriction violated`.
 * Returns false when the SDK holds no state for this device, leaving the
 * caller to decide what to do instead.
 */
export async function pauseLocalPlayback(): Promise<boolean> {
	const playbackState = await player?.getCurrentState();
	if (!playbackState) return false;
	if (!playbackState.paused) await player?.pause();
	return true;
}

/**
 * Only a genuine resume: the device must already hold `trackId`.
 *
 * Checking the track is what keeps this honest. Without it, a device still
 * sitting on the previous round's track would report "resumed" and the new
 * track would never start — and a device that holds nothing at all (a host
 * promoted mid-game) would fall through to a Web API call that can only 403.
 */
export async function resumeLocalPlayback(trackId: string): Promise<boolean> {
	const playbackState = await player?.getCurrentState();
	if (!playbackState) return false;
	if (playbackState.track_window?.current_track?.id !== trackId) return false;
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
