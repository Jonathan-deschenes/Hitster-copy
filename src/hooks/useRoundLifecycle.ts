import { useCallback, useEffect, useRef, useState } from "react";
import { GameStatus } from "../types";
import type { GameStateEnum, gameStateProps } from "../types";
import { finishRound } from "../lib/lobbies";
import { remainingSeconds } from "../lib/playback";

interface UseRoundLifecycleParams {
	code?: string;
	gameState?: gameStateProps;
	/** The host flag alone — scoring duty, owed even without a Spotify device. */
	isHostPlayer: boolean;
	/** Numbers, not the players array: its identity changes on every realtime update. */
	answeredCount: number;
	playerCount: number;
}

/**
 * Owns the round clock and the payout.
 *
 * Every client derives the countdown; only the host ends the round, because
 * scoring rewrites the whole players array and concurrent writers clobber each
 * other. The two round-enders (clock hits 0, everyone answered) share one
 * `finalizeRound` so the payout stays at one per round whichever fires first.
 */
export function useRoundLifecycle({
	code,
	gameState,
	isHostPlayer,
	answeredCount,
	playerCount,
}: UseRoundLifecycleParams) {
	const gameStatus = gameState?.status;
	const isPlaying = gameStatus === GameStatus.Playing;

	// Whether this client already paid out the current round. Deliberately a
	// boolean, not a round number: "relancer la partie" resets `round` to 0, and
	// a remembered number would match the new game's first round forever.
	const roundFinalizedRef = useRef(false);

	const finalizeRound = useCallback((lobbyCode: string) => {
		if (roundFinalizedRef.current) return;
		roundFinalizedRef.current = true;

		finishRound(lobbyCode).catch((error) => {
			console.error(error);
			// Keep the round active: forcing `finished` client-side would bypass
			// server grading and produce a reveal with no metadata.
			roundFinalizedRef.current = false;
		});
	}, []);

	// Only paces the re-renders that recompute the countdown — the countdown
	// itself is derived from the round clock in the lobby row, never decremented.
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!isPlaying) return;
		const intervalId = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(intervalId);
	}, [isPlaying]);

	const counter = remainingSeconds(gameState, now);

	// Re-arm the payout when a *new* round starts. Resuming from a pause is not
	// a new round, hence the previous-status check.
	const prevStatus = useRef<GameStateEnum | undefined>(undefined);
	useEffect(() => {
		const previousStatus = prevStatus.current;
		prevStatus.current = gameStatus;

		if (gameStatus !== GameStatus.Playing) return;
		if (previousStatus === GameStatus.Paused) return;

		roundFinalizedRef.current = false;
	}, [gameStatus]);

	// The countdown reaching 0. Non-host clients just sit at 0 and wait for the
	// realtime update.
	useEffect(() => {
		if (!code || !isPlaying || !isHostPlayer) return;
		if (counter > 0) return;

		finalizeRound(code);
	}, [code, isPlaying, isHostPlayer, counter, finalizeRound]);

	// Nobody left to answer, so there's no point running the clock down.
	// Restricted to `Playing` so a paused round stays paused even if the last
	// answer lands during the pause.
	useEffect(() => {
		if (!code || !isHostPlayer) return;
		if (gameStatus !== GameStatus.Playing) return;
		if (playerCount === 0 || answeredCount < playerCount) return;

		finalizeRound(code);
	}, [code, isHostPlayer, gameStatus, answeredCount, playerCount, finalizeRound]);

	return { counter };
}
