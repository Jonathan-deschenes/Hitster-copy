import { supabaseAnonKey, supabaseUrl } from "../supabaseClient";

const SESSION_PREFIX = "lobby-session";

function storageKey(code: string, playerId: string) {
	return `${SESSION_PREFIX}:${code}:${playerId}`;
}

export function createLobbySessionToken(): string {
	return crypto.randomUUID();
}

export function storeLobbySessionToken(
	code: string,
	playerId: string,
	token: string,
) {
	try {
		sessionStorage.setItem(storageKey(code, playerId), token);
	} catch {
		/* sessionStorage unavailable */
	}
}

export function getLobbySessionToken(
	code: string | undefined,
	playerId: string | null,
): string | null {
	if (!code || !playerId) return null;
	try {
		return sessionStorage.getItem(storageKey(code, playerId));
	} catch {
		return null;
	}
}

export function clearLobbySessionToken(code: string, playerId: string) {
	try {
		sessionStorage.removeItem(storageKey(code, playerId));
	} catch {
		/* sessionStorage unavailable */
	}
}

/**
 * `pagehide` can outlive React and the Supabase client request queue. A direct
 * keepalive request gives PostgreSQL the best chance to start the short,
 * reload-safe disconnect grace period before the browser tears the page down.
 */
export function markLobbySessionDisconnecting(
	code: string,
	playerId: string,
	sessionToken: string,
) {
	void fetch(`${supabaseUrl}/rest/v1/rpc/mark_lobby_session_disconnecting`, {
		method: "POST",
		headers: {
			apikey: supabaseAnonKey,
			Authorization: `Bearer ${supabaseAnonKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			lobby_code: code,
			session_player_id: playerId,
			provided_session_token: sessionToken,
		}),
		keepalive: true,
	}).catch(() => {
		// The heartbeat lease remains the crash/transport-failure backstop.
	});
}
