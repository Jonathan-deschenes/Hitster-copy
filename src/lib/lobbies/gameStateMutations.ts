import { supabase } from "../supabaseClient";
import type {
	gameStateProps,
	GameStateEnum,
	lobbyProps,
	lobbyRowProps,
	lobbySettingsFormProps,
	playlistQueueProps,
} from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";
import { fetchPlaylistTracks } from "../spotify/playlist";
import { shuffle } from "lodash";
import { resolveGameQuestion } from "../../util";

const UNIQUE_VIOLATION = "23505";

// Reads the current game_state and merges the patch into it rather than
// overwriting the whole column, so a status change doesn't clobber a
// concurrent turn/round update (or vice versa). Since this is a
// read-then-write, two overlapping calls can still race each other.
async function updateGameState(
	code: string,
	patch: Partial<gameStateProps>,
): Promise<lobbyProps> {
	const row = await findLobbyRowByCode(code);
	if (!row) {
		throw new Error(`Aucun lobby trouvé avec le code ${code}.`);
	}

	const { data, error } = await supabase
		.from("lobbies")
		.update({ game_state: { ...row.game_state, ...patch } })
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

export async function updateGameStatus(
	code: string,
	status: GameStateEnum,
): Promise<lobbyProps> {
	return updateGameState(code, { status });
}

export async function updateTurn(
	code: string,
	turn: number,
): Promise<lobbyProps> {
	return updateGameState(code, { turn });
}

export async function updateRound(
	code: string,
	round: number,
): Promise<lobbyProps> {
	return updateGameState(code, { round });
}

export async function updateGameQuestion(
	code: string,
	question: string,
): Promise<lobbyProps> {
	return updateGameState(code, { question });
}

export async function updatePlayerAnswer(
	code: string,
	answer: string,
	playerId: string,
): Promise<lobbyProps | null> {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	const players = row.players.map((player) =>
		player.id === playerId ? { ...player, answer } : player,
	);

	const { data, error } = await supabase
		.from("lobbies")
		.update({ players })
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

export async function resetPlayerAnswer(code: string) {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	const players = row.players.map((player) => ({ ...player, answer: "" }));

	const { data, error } = await supabase
		.from("lobbies")
		.update({ players })
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

export async function updateGameSettings(
	code: string,
	updatedSettings: lobbySettingsFormProps,
) {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	const { data, error } = await supabase
		.from("lobbies")
		.update({
			is_public: updatedSettings.public,
			category: updatedSettings.category,
			game_state: {
				...row.game_state,
				round: 0,
				mode: updatedSettings.mode,
				status: "waiting",
				question: resolveGameQuestion(updatedSettings.mode),
				totalRounds: updatedSettings.rounds,
				duration: updatedSettings.duration,
			},
		})
		.eq("code", code)
		.select()
		.single();

	if (!error && data) {
		const row = data as lobbyRowProps;

		const tracks = await fetchPlaylistTracks(
			updatedSettings.category.value,
			updatedSettings.rounds,
		);
		const music_queue: playlistQueueProps = {
			items: shuffle(tracks),
			current: 0,
		};

		const { data: withQueue, error: queueError } = await supabase
			.from("lobbies")
			.update({ music_queue })
			.eq("id", row.id)
			.select()
			.single();

		if (queueError) throw queueError;
		return rowToLobby(withQueue as lobbyRowProps);
	}

	if (error && error.code !== UNIQUE_VIOLATION) {
		throw error;
	}
	return rowToLobby(data as lobbyRowProps);
}
