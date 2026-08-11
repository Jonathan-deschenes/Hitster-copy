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
 * Reconciler input: the desired playback state as a function of the row alone.
 *
 * Deliberately stateless — no memory of what happened before. The previous
 * design read a per-tab ref of the last status, which a promoted host never
 * populated (its effect early-returned all game while it wasn't host), so it
 * acted on beliefs it never formed and issued commands its device couldn't
 * honour. Deriving from the row means any client reaches the same conclusion,
 * including one that just took over mid-round.
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

		// The round is over and the answer is on screen, but the track carries on
		// underneath it — players get to actually hear the song they were
		// guessing at. `idle` rather than a `play` at the round's position: by
		// now `elapsedMs` has run past the round duration and would keep
		// growing, so re-issuing it would seek past the end of the track. Doing
		// nothing leaves whatever is already playing alone, which is the point.
		//
		// The next `startRound` replaces the track, and "relancer la partie"
		// (→ `Waiting`) stops it.
		case GameStatus.Finished:
			return { kind: "idle" };

		case GameStatus.Paused:
		case GameStatus.Waiting:
			return { kind: "pause" };

		default:
			return { kind: "idle" };
	}
}
