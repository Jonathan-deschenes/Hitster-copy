import { GameStatus } from "../../types";
import type {
	gameStateProps,
	GameModeEnum,
	GameStateEnum,
	lobbyProps,
	lobbySettingsFormProps,
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
	const { error } = await supabase.functions.invoke("start-round", {
		body: { lobbyCode: code },
	});
	if (error) throw new Error("Impossible de démarrer la manche.");
	const row = await findLobbyRowByCode(code);
	return row ? rowToLobby(row) : null;
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
export async function finishRound(code: string): Promise<lobbyProps | null> {
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
	const { question, questionMode } = resolveGameQuestion(updatedSettings.mode);

	const { data, error } = await supabase
		.rpc("update_lobby_settings", {
			lobby_code: code,
			next_public: updatedSettings.public,
			next_category: updatedSettings.category,
			next_mode: updatedSettings.mode as GameModeEnum,
			next_question: question,
			next_question_mode: questionMode,
			next_rounds: updatedSettings.rounds,
			next_duration: updatedSettings.duration,
		})
		.select()
		.maybeSingle();

	if (error) throw error;
	if (!data) return null;

	// A new playlist or round count needs a matching queue.
	return regenerateMusicQueue((data as { id: string }).id);
}
