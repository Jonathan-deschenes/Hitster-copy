import { GameStatus } from "../../types";
import type { gameStateProps } from "../../types";

/**
 * How far into the round we are, in ms.
 *
 * Every client computes this from the same persisted timestamp rather than
 * counting down locally, so two browsers can't drift apart and a mid-round
 * refresh lands on the right second instead of restarting at full duration.
 *
 * Lobbies created before `roundStartedAt` existed report 0, which degrades to
 * the old behaviour (track starts at the beginning) instead of throwing.
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
