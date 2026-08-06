import { generateCodeChallenge, generateRandomString } from "./pkce";
import { StorageKeys, StorageUtility } from "../../hooks/useStorage";

const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

const SCOPES = [
	"playlist-read-private",
	"playlist-read-collaborative",
	"streaming",
	"user-read-email",
	"user-read-private",
	"user-modify-playback-state",
	"user-read-playback-state",
].join(" ");

const VERIFIER_STORAGE_KEY = "spotify_pkce_verifier";
const STATE_STORAGE_KEY = "spotify_pkce_state";
const RETURN_TO_STORAGE_KEY = "spotify_return_to";

type StoredAuth = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

type TokenResponse = {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
};

export class SpotifyAuthRequiredError extends Error {}

function getClientId(): string {
	const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
	if (!clientId) {
		throw new Error("VITE_SPOTIFY_CLIENT_ID manquant (voir .env.example).");
	}
	return clientId;
}

function getRedirectUri(): string {
	return (
		import.meta.env.VITE_SPOTIFY_REDIRECT_URI ??
		`${window.location.origin}/spotify/callback`
	);
}

function readStoredAuth(): StoredAuth | null {
	return StorageUtility.getItem<StoredAuth>(StorageKeys.SPOTIFY_HOST_AUTH);
}

function writeStoredAuth(auth: StoredAuth) {
	StorageUtility.setItem(StorageKeys.SPOTIFY_HOST_AUTH, auth);
}

export function clearSpotifyAuth() {
	StorageUtility.removeItem(StorageKeys.SPOTIFY_HOST_AUTH);
}

export function isSpotifyConnected(): boolean {
	return readStoredAuth() !== null;
}

/** Kicks off the Authorization Code + PKCE flow: redirects the browser to Spotify's login. */
export async function redirectToSpotifyLogin(returnTo: string) {
	const verifier = generateRandomString(64);
	const state = generateRandomString(16);
	const challenge = await generateCodeChallenge(verifier);

	sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
	sessionStorage.setItem(STATE_STORAGE_KEY, state);
	sessionStorage.setItem(RETURN_TO_STORAGE_KEY, returnTo);

	const params = new URLSearchParams({
		client_id: getClientId(),
		response_type: "code",
		redirect_uri: getRedirectUri(),
		scope: SCOPES,
		code_challenge_method: "S256",
		code_challenge: challenge,
		state,
	});

	window.location.assign(`${AUTHORIZE_ENDPOINT}?${params.toString()}`);
}

/** Called from the /spotify/callback route. Exchanges the auth code for tokens. */
export async function completeSpotifyLogin(
	code: string,
	state: string,
): Promise<string> {
	const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
	const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
	const returnTo = sessionStorage.getItem(RETURN_TO_STORAGE_KEY) ?? "/";

	sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
	sessionStorage.removeItem(STATE_STORAGE_KEY);
	sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);

	if (!verifier || !expectedState || state !== expectedState) {
		throw new Error("Échec de la vérification PKCE, réessaie la connexion Spotify.");
	}

	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: getRedirectUri(),
		client_id: getClientId(),
		code_verifier: verifier,
	});

	const response = await fetch(TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});

	if (!response.ok) {
		throw new Error("Impossible d'obtenir un token Spotify.");
	}

	const data = (await response.json()) as TokenResponse;
	storeTokenResponse(data);

	return returnTo;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: getClientId(),
	});

	const response = await fetch(TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});

	if (!response.ok) {
		clearSpotifyAuth();
		throw new SpotifyAuthRequiredError("Session Spotify expirée, reconnecte le host.");
	}

	const data = (await response.json()) as TokenResponse;
	storeTokenResponse(data, refreshToken);

	return data.access_token;
}

function storeTokenResponse(data: TokenResponse, fallbackRefreshToken?: string) {
	writeStoredAuth({
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? fallbackRefreshToken ?? "",
		expiresAt: Date.now() + (data.expires_in - 60) * 1000,
	});
}

/** Returns a valid access token for the connected host, refreshing it if needed. */
export async function getHostAccessToken(): Promise<string> {
	const stored = readStoredAuth();

	if (!stored) {
		throw new SpotifyAuthRequiredError("Connexion Spotify du host requise.");
	}

	if (stored.expiresAt > Date.now()) {
		return stored.accessToken;
	}

	return refreshAccessToken(stored.refreshToken);
}
