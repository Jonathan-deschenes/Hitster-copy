import { GameStatus } from "../../types";
import type { gameStateProps } from "../../types";
import { elapsedMs } from "./clock";

/**
 * What the host's device should be doing right now, derived purely from the
 * lobby row.
 *
 * `idle` means "no opinion" — don't touch the device at all. It is not the
 * same as `pause`, which actively stops it.
 */
export type PlaybackIntent =
	| { kind: "play"; trackId: string; positionMs: number }
	| { kind: "pause" }
	| { kind: "idle" };

/**
 * Deliberately stateless — no memory of what happened before, so a host
 * promoted mid-round reaches the same conclusion as one who started the game.
 */
export function resolvePlaybackIntent(
	gameState: gameStateProps | undefined,
	trackId: string | undefined,
	now: number = Date.now(),
): PlaybackIntent {
	if (!gameState) return { kind: "idle" };

	switch (gameState.status) {
		case GameStatus.Playing:
			// No track to play yet (queue still being written at lobby creation):
			// leave the device alone rather than pausing something valid.
			if (!trackId) return { kind: "idle" };
			return { kind: "play", trackId, positionMs: elapsedMs(gameState, now) };

		// The track plays on under the reveal. Must be `idle`, not a `play`:
		// `elapsedMs` has run past the duration, so re-issuing a position would
		// seek past the end of the track.
		case GameStatus.Finished:
			return { kind: "idle" };

		// Unlike `Finished`, the game is over for good: nothing is left to guess,
		// so the track stops instead of playing on under the standings.
		case GameStatus.Ended:
		case GameStatus.Paused:
		case GameStatus.Waiting:
			return { kind: "pause" };

		default:
			return { kind: "idle" };
	}
}
