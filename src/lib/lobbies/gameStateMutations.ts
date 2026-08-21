import { GameStatus } from "../../types";
import type {
	gameStateProps,
	GameModeEnum,
	GameStateEnum,
	lobbyProps,
	lobbySettingsFormProps,
	playerProps,
} from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";
import {
	regenerateMusicQueue,
	requireLobbyRow,
	updateLobbyRow,
} from "./rowOperations";
import { resolveGameQuestion } from "../../util";
import { elapsedMs } from "../playback";
import { supabase } from "../supabaseClient";

// Merges the patch into the existing game_state rather than overwriting the
// column, so a status change doesn't clobber a concurrent round update. Still
// a read-then-write: two overlapping calls can race.
async function updateGameState(
	code: string,
	patch: Partial<gameStateProps>,
): Promise<lobbyProps> {
	const row = await requireLobbyRow(code);
	return updateLobbyRow(code, {
		game_state: { ...row.game_state, ...patch },
	});
}

export async function updateGameStatus(
	code: string,
	status: GameStateEnum,
): Promise<lobbyProps> {
	return updateGameState(code, { status });
}

// There are deliberately no `updateRound` / `updateGameQuestion` /
// `resetPlayerAnswer` helpers: those three only ever change together, and
// issuing them separately is what let clients observe a half-started round.
// `startRound` does all of it in one write.

/** Wipes last round's answers and verdicts. */
function withClearedAnswers(players: playerProps[]): playerProps[] {
	return players.map((player) => ({
		...player,
		answer: "",
		answeredAt: undefined,
		roundPoints: 0,
		roundCorrect: false,
	}));
}

/**
 * Begins a round — the first one (`waiting` → `playing`) and every later one
 * (`finished` → `playing`) alike.
 *
 * Everything goes out in **one** write: cleared answers, question, round,
 * status, clock and track pointer. Splitting it let clients observe a
 * half-started round, and deriving `current` from `round` (never incrementing
 * it) is what stops concurrent clients from skipping tracks. See CLAUDE.md.
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

	// `current === round` is the invariant, so recomputing it means the pointer
	// cannot drift no matter how often this runs.
	const items = row.music_queue?.items ?? [];
	const current = Math.min(round, Math.max(items.length - 1, 0));

	return updateLobbyRow(code, {
		players: withClearedAnswers(row.players),
		game_state: {
			...gameState,
			question,
			questionMode,
			round,
			status: GameStatus.Playing,
			roundStartedAt: Date.now(),
			pausedElapsedMs: undefined,
			revealedTrack: undefined,
		},
		music_queue: { ...row.music_queue, items, current },
	});
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
 * with last round's points still on screen. Host-only — see `useRoundLifecycle`.
 */
export async function finishRound(
	code: string,
): Promise<lobbyProps | null> {
	const { error } = await supabase.functions.invoke("finish-round", {
		body: { lobbyCode: code },
	});
	if (error) throw new Error("Impossible de terminer la manche.");
	const row = await findLobbyRowByCode(code);
	return row ? rowToLobby(row) : null;
}

export async function updatePlayerAnswer(
	code: string,
	answer: string,
	playerId: string,
): Promise<lobbyProps | null> {
	const { error } = await supabase.functions.invoke("submit-answer", {
		body: { lobbyCode: code, playerId, answer },
	});
	if (error) throw new Error("Impossible d'envoyer la réponse.");
	const row = await findLobbyRowByCode(code);
	return row ? rowToLobby(row) : null;
}

export async function updateGameSettings(
	code: string,
	updatedSettings: lobbySettingsFormProps,
) {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	const { question, questionMode } = resolveGameQuestion(updatedSettings.mode);

	await updateLobbyRow(code, {
		is_public: updatedSettings.public,
		category: updatedSettings.category,
		game_state: {
			...row.game_state,
			round: 0,
			mode: updatedSettings.mode as GameModeEnum,
			status: GameStatus.Waiting,
			question,
			questionMode,
			totalRounds: updatedSettings.rounds,
			duration: updatedSettings.duration,
			// A restart has no round in flight, so the clock has to go too:
			// a leftover timestamp would make the lobby look mid-round.
			roundStartedAt: undefined,
			pausedElapsedMs: undefined,
			revealedTrack: undefined,
		},
		// This doubles as the "relancer la partie" path, so the standings go
		// back to zero along with the round counter.
		players: withClearedAnswers(row.players).map((player) => ({
			...player,
			score: 0,
		})),
	});

	// A new playlist or round count needs a matching queue.
	return regenerateMusicQueue(row.id);
}
