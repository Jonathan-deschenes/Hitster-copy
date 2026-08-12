import { GameStatus } from "../../types";
import type { gameStateProps } from "../../types";

/**
 * How far into the round we are, in ms — computed from the persisted timestamp
 * so no two clients drift. Rows without `roundStartedAt` report 0 rather than
 * throwing.
 */
export function elapsedMs(
	gameState: gameStateProps | undefined,
	now: number = Date.now(),
): number {
	if (!gameState) return 0;

	if (gameState.status === GameStatus.Paused) {
		return Math.max(0, gameState.pausedElapsedMs ?? 0);
	}

	if (gameState.roundStartedAt == null) return 0;
	return Math.max(0, now - gameState.roundStartedAt);
}

/** Seconds left in the round, clamped to [0, duration]. */
export function remainingSeconds(
	gameState: gameStateProps | undefined,
	now: number = Date.now(),
): number {
	const duration = gameState?.duration ?? 30;

	// Nothing has started the clock yet (a lobby still in `waiting`, or a
	// pre-`roundStartedAt` row), so the round reads as untouched.
	if (!gameState || gameState.roundStartedAt == null) return duration;

	const left = duration - elapsedMs(gameState, now) / 1000;
	return Math.min(duration, Math.max(0, Math.ceil(left)));
}
