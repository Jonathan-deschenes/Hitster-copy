import { supabase } from "../supabaseClient";
import { GameStatus } from "../../types";
import type {
	gameStateProps,
	GameModeEnum,
	GameStateEnum,
	lobbyProps,
	lobbyRowProps,
	lobbySettingsFormProps,
	musicItemsProps,
	playlistQueueProps,
} from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";
import { fetchPlaylistTracks } from "../spotify/playlist";
import { shuffle } from "lodash";
import { resolveGameQuestion } from "../../util";
import { scoreRound } from "../scoring";

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
	questionMode: GameModeEnum,
): Promise<lobbyProps> {
	return updateGameState(code, { question, questionMode });
}

/**
 * Ends the round: grades every answer against the track and reveals it.
 *
 * Scores and `status` go out in a single update so the reveal never appears
 * with last round's points still on screen. Only the host is expected to call
 * this — see the timer in `pages/Game.tsx`.
 */
export async function finishRound(
	code: string,
	track: musicItemsProps | undefined,
): Promise<lobbyProps | null> {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	// The caller's effect can fire more than once for one round; without this
	// the same answers would be paid out twice.
	if (row.game_state.status === GameStatus.Finished) {
		return rowToLobby(row);
	}

	const results = scoreRound(
		row.players,
		track,
		row.game_state.questionMode ?? row.game_state.mode,
	);

	const players = row.players.map((player) => {
		const { points, correct } = results[player.id] ?? {
			points: 0,
			correct: false,
		};
		return {
			...player,
			score: (player.score ?? 0) + points,
			roundPoints: points,
			roundCorrect: correct,
		};
	});

	const { data, error } = await supabase
		.from("lobbies")
		.update({
			players,
			game_state: { ...row.game_state, status: GameStatus.Finished },
		})
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
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

	// Last round's verdict goes too, so the next reveal can't briefly show
	// stale points against a fresh (empty) answer.
	const players = row.players.map((player) => ({
		...player,
		answer: "",
		roundPoints: 0,
		roundCorrect: false,
	}));

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

	const { question, questionMode } = resolveGameQuestion(updatedSettings.mode);

	const { data, error } = await supabase
		.from("lobbies")
		.update({
			is_public: updatedSettings.public,
			category: updatedSettings.category,
			game_state: {
				...row.game_state,
				round: 0,
				mode: updatedSettings.mode as GameModeEnum,
				status: "waiting",
				question,
				questionMode,
				totalRounds: updatedSettings.rounds,
				duration: updatedSettings.duration,
			},
			// This doubles as the "relancer la partie" path, so the standings
			// have to go back to zero along with the round counter.
			players: row.players.map((player) => ({
				...player,
				score: 0,
				answer: "",
				roundPoints: 0,
				roundCorrect: false,
			})),
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
