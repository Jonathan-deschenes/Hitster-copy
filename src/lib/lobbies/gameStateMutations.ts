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
	playerProps,
	playlistQueueProps,
} from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";
import { fetchPlaylistTracks } from "../spotify/playlist";
import { shuffle } from "lodash";
import { resolveGameQuestion } from "../../util";
import { scoreRound } from "../scoring";
import { elapsedMs } from "../playback";

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

// There are deliberately no `updateRound` / `updateGameQuestion` /
// `resetPlayerAnswer` helpers. Round, question and cleared answers only ever
// change together, at the start of a round, and issuing them as separate
// writes is what let clients observe a half-started round — see `startRound`,
// which does all of it in one update.

/** Wipes last round's answers and verdicts. */
function withClearedAnswers(players: playerProps[]): playerProps[] {
	return players.map((player) => ({
		...player,
		answer: "",
		roundPoints: 0,
		roundCorrect: false,
	}));
}

/**
 * Begins a round — both the first one (`waiting` → `playing`) and every
 * subsequent one (`finished` → `playing`).
 *
 * Everything a round needs goes out in **one** update: cleared answers, the
 * new question, the round counter, the status, the round clock and the track
 * pointer. That matters for two reasons:
 *
 * 1. The track index is *derived* from `round`, never incremented. The old
 *    code advanced it from `pages/Game.tsx` on every client, so N browsers
 *    each ran a read-modify-write on `music_queue` from their own snapshot of
 *    `current` — one of them writing a stale value skipped a track (or rewound
 *    the queue) for everyone, and the drift was permanent because the queue
 *    holds exactly `totalRounds` items.
 * 2. Clients never observe an intermediate state. This used to be four
 *    sequential writes, so `status: playing` arrived before the new track and
 *    the countdown started a full round-trip ahead of the audio.
 */
export async function startRound(code: string): Promise<lobbyProps | null> {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	const gameState = row.game_state;

	// Same shape as `finishRound`'s guard below: a double-fired handler can't
	// advance the round twice.
	if (gameState.status === GameStatus.Playing) return rowToLobby(row);

	// Only a finished round draws the next question; starting the very first
	// one keeps whatever `createLobby`/`updateGameSettings` already picked.
	const advancing = gameState.status === GameStatus.Finished;
	const round = advancing ? gameState.round + 1 : gameState.round;
	const { question, questionMode } = advancing
		? resolveGameQuestion(gameState.mode)
		: { question: gameState.question, questionMode: gameState.questionMode };

	// `createLobby` starts at round 0 with `current` 0, and starting the game
	// doesn't touch `round`, so `current === round` is the invariant. Recomputing
	// it means the pointer cannot drift no matter how often this runs.
	const items = row.music_queue?.items ?? [];
	const current = Math.min(round, Math.max(items.length - 1, 0));

	const { data, error } = await supabase
		.from("lobbies")
		.update({
			players: withClearedAnswers(row.players),
			game_state: {
				...gameState,
				question,
				questionMode,
				round,
				status: GameStatus.Playing,
				roundStartedAt: Date.now(),
				pausedElapsedMs: undefined,
			},
			music_queue: { ...row.music_queue, items, current },
		})
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

/**
 * Freezes the round clock alongside the status, so the elapsed time a later
 * resume restores doesn't include however long the game sat paused.
 */
export async function pauseRound(code: string): Promise<lobbyProps | null> {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	if (row.game_state.status !== GameStatus.Playing) return rowToLobby(row);

	return updateGameState(code, {
		status: GameStatus.Paused,
		pausedElapsedMs: elapsedMs(row.game_state),
	});
}

/**
 * Rewinds `roundStartedAt` by the elapsed time instead of storing a separate
 * offset, so `now - roundStartedAt` stays the single expression every client
 * uses to find both the countdown and the track position.
 */
export async function resumeRound(code: string): Promise<lobbyProps | null> {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	if (row.game_state.status !== GameStatus.Paused) return rowToLobby(row);

	return updateGameState(code, {
		status: GameStatus.Playing,
		roundStartedAt: Date.now() - elapsedMs(row.game_state),
		pausedElapsedMs: undefined,
	});
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
				// A restart has no round in flight, so the clock has to go too:
				// a leftover timestamp would make the lobby look mid-round.
				roundStartedAt: undefined,
				pausedElapsedMs: undefined,
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
