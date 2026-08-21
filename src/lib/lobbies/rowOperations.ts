import { supabase } from "../supabaseClient";
import type { lobbyProps, lobbyRowProps } from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";

/** Postgres `unique_violation` — the `code` column collided. */
export const UNIQUE_VIOLATION = "23505";

/**
 * The lobby row, or a thrown error naming the code. For callers that treat a
 * missing lobby as an error; the ones that return `null` instead keep using
 * `findLobbyRowByCode` directly.
 */
export async function requireLobbyRow(code: string): Promise<lobbyRowProps> {
	const row = await findLobbyRowByCode(code);
	if (!row) throw new Error(`Aucun lobby trouvé avec le code ${code}.`);
	return row;
}

/**
 * Writes columns onto a lobby and maps the result back into app shape.
 *
 * Every mutation here is a read-modify-write on jsonb, so concurrent writers
 * clobber each other — this only removes the boilerplate, it does not make the
 * write atomic. Check who can call yours at the same time.
 */
export async function updateLobbyRow(
	code: string,
	patch: Record<string, unknown>,
): Promise<lobbyProps> {
	const { data, error } = await supabase
		.from("lobbies")
		.update(patch)
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

/** Same, keyed by row id — for the write that follows an insert. */
export async function updateLobbyRowById(
	id: string,
	patch: Record<string, unknown>,
): Promise<lobbyProps> {
	const { data, error } = await supabase
		.from("lobbies")
		.update(patch)
		.eq("id", id)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

/**
 * Draws a fresh shuffled queue for the playlist and writes it onto the row.
 * Shared by lobby creation and "relancer la partie" — the queue holds up to
 * `rounds` items, since `startRound` derives its pointer from the round number
 * and a shorter-than-requested queue is already a handled case (see
 * `isFinalRound`).
 *
 * Playback plays a YouTube video, not the Spotify track itself, so every item
 * needs at least one matched video id. A track with no match at all is
 * dropped instead of queued unplayable — the extra headroom
 * (`QUEUE_BUFFER_RATIO`) over `rounds` keeps a normal playlist from coming up
 * short from a few misses.
 */
export async function regenerateMusicQueue(
	rowId: string,
): Promise<lobbyProps> {
	const { error } = await supabase.functions.invoke("regenerate-music-queue", {
		body: { lobbyId: rowId },
	});
	if (error) throw new Error("Impossible de préparer la file musicale.");

	const { data, error: readError } = await supabase
		.from("lobbies")
		.select()
		.eq("id", rowId)
		.single();
	if (readError) throw readError;
	return rowToLobby(data as lobbyRowProps);
}
