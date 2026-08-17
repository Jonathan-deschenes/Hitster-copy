import { supabase } from "../supabaseClient";
import type {
	gameCategoryProps,
	lobbyProps,
	lobbyRowProps,
	musicItemsProps,
	playlistQueueProps,
} from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";
import { fetchPlaylistTracks } from "../spotify/playlist";
import { matchYoutubeVideos } from "../youtube/search";
import shuffle from "lodash/shuffle";

/** Headroom over `rounds` so a few unmatched YouTube searches don't shrink the queue. */
const QUEUE_BUFFER_RATIO = 1.3;

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
	category: gameCategoryProps,
	rounds: number,
): Promise<lobbyProps> {
	const tracks = await fetchPlaylistTracks(
		category.value,
		Math.ceil(rounds * QUEUE_BUFFER_RATIO),
	);
	// Cache-only: a lobby is built purely from tracks already warmed into the
	// YouTube cache, so creating a game never spends search quota. Tracks not yet
	// cached come back empty and are dropped below — warm the cache ahead of time
	// with scripts/warm-youtube-cache.mjs.
	const matches = await matchYoutubeVideos(
		tracks.map((track) => ({ id: track.id, name: track.name, artist: track.artist })),
		{ cacheOnly: true },
	);

	const matched: musicItemsProps[] = tracks
		.map((track) => ({ ...track, youtubeIds: matches[track.id] ?? [] }))
		.filter((track): track is musicItemsProps => track.youtubeIds.length > 0)
		.slice(0, rounds);

	// An empty queue is an unplayable game — surface it clearly instead of
	// writing a lobby nobody can start. Most likely the playlist isn't cached yet.
	if (matched.length === 0) {
		throw new Error(
			"Aucune musique en cache pour cette playlist. Réessaie une fois la mise en cache terminée.",
		);
	}

	const music_queue: playlistQueueProps = {
		items: shuffle(matched),
		current: 0,
	};

	return updateLobbyRowById(rowId, { music_queue });
}
