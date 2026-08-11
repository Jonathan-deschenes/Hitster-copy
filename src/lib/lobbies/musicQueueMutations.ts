import { supabase } from "../supabaseClient";
import type { lobbyProps, lobbyRowProps, playlistQueueProps } from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";

export async function getMusicQueue(code: string): Promise<playlistQueueProps> {
	const row = await findLobbyRowByCode(code);
	if (!row) {
		throw new Error(`Aucun lobby trouvé avec le code ${code}.`);
	}

	return row.music_queue;
}

export async function removeMusicFromQueue(
	code: string,
	musicId: string,
): Promise<lobbyProps> {
	const row = await findLobbyRowByCode(code);
	if (!row) {
		throw new Error(`Aucun lobby trouvé avec le code ${code}.`);
	}

	const removedIndex = row.music_queue.items.findIndex((music) => music.id === musicId);
	const items = row.music_queue.items.filter((music) => music.id !== musicId);

	// Keep `current` pointing at the same track when possible: shift it back
	// by one if the removed track was before it, then clamp into range.
	let current = row.music_queue.current;
	if (removedIndex !== -1 && removedIndex < current) {
		current -= 1;
	}
	current = Math.min(current, Math.max(items.length - 1, 0));

	return updateMusicQueue(code, { items, current });
}

async function updateMusicQueue(
	code: string,
	music_queue: playlistQueueProps,
): Promise<lobbyProps> {
	const { data, error } = await supabase
		.from("lobbies")
		.update({ music_queue })
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}
