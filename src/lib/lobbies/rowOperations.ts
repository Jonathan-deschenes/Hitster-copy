import { supabase } from "../supabaseClient";
import type {
	gameCategoryProps,
	lobbyProps,
	lobbyRowProps,
	playlistQueueProps,
} from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";
import { fetchPlaylistTracks } from "../spotify/playlist";
import shuffle from "lodash/shuffle";

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
 * Shared by lobby creation and "relancer la partie" — the queue holds exactly
 * `rounds` items, since `startRound` derives its pointer from the round number.
 */
export async function regenerateMusicQueue(
	rowId: string,
	category: gameCategoryProps,
	rounds: number,
): Promise<lobbyProps> {
	const tracks = await fetchPlaylistTracks(category.value, rounds);
	const music_queue: playlistQueueProps = {
		items: shuffle(tracks),
		current: 0,
	};

	return updateLobbyRowById(rowId, { music_queue });
}
