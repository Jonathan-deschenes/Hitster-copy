import { useEffect, useRef } from "react";
import type { gameStateProps } from "../types";
import { resolvePlaybackIntent } from "../lib/playback";
import type { PlaybackIntent } from "../lib/playback";
import { showToast } from "../lib/toast";
import type { spotifyPlayerHandleProps } from "./useSpotifyPlayer";

interface UseHostPlaybackParams {
	/** Host flag **and** a connected Spotify account — gates playback commands. */
	isHost: boolean;
	/** Host flag alone — gates the stop-on-demotion, owed even without a device. */
	isHostPlayer: boolean;
	gameState?: gameStateProps;
	currentTrackId?: string;
	/** The whole memoized handle: a narrowed literal would re-run the reconciler every render. */
	spotifyPlayer: spotifyPlayerHandleProps;
}

/**
 * Drives this tab's Spotify device from the lobby row.
 *
 * A reconciler, not a state machine: `resolvePlaybackIntent` derives what the
 * device should be doing from the row alone and has no memory, so a host
 * promoted mid-game acts on the same facts as one who started the game.
 */
export function useHostPlayback({
	isHost,
	isHostPlayer,
	gameState,
	currentTrackId,
	spotifyPlayer,
}: UseHostPlaybackParams) {
	useEffect(() => {
		if (spotifyPlayer.error) showToast(spotifyPlayer.error, "error");
	}, [spotifyPlayer.error]);

	// Manual promotion leaves the outgoing host on this page (unlike leaving the
	// lobby, which pauses via handleLeaving first) — stop their device the moment
	// they lose the host flag via realtime. Keyed on the flag alone so a host
	// whose token lapsed mid-game still gets the attempt.
	const wasHostPlayerRef = useRef(false);
	useEffect(() => {
		if (wasHostPlayerRef.current && !isHostPlayer) {
			spotifyPlayer.pause();
		}
		wasHostPlayerRef.current = isHostPlayer;
	}, [isHostPlayer, spotifyPlayer]);

	// What this device has already been told to do, so an identical intent issues
	// no command. Only dedupes — the intent itself is re-derived from the row.
	const appliedRef = useRef<{
		kind?: PlaybackIntent["kind"];
		trackId?: string;
		/** Held back so reporting an error — which re-renders — can't spin into a retry loop. */
		failedTrackId?: string;
	}>({});

	// NOT the same boolean as `wasHostPlayerRef` above: this one keys on `isHost`
	// because it answers "did this client ever populate `appliedRef`?", and the
	// effect below early-returns while `!isHost`. See CLAUDE.md.
	const wasHostWithDeviceRef = useRef(isHost);

	useEffect(() => {
		// A player who was never host issued nothing, so `appliedRef` stayed empty.
		// Clearing it on promotion is what stops a fresh host from acting on
		// beliefs it never formed.
		const wasHost = wasHostWithDeviceRef.current;
		wasHostWithDeviceRef.current = isHost;
		if (isHost && !wasHost) appliedRef.current = {};

		if (!isHost || !spotifyPlayer.isReady || !gameState) return;

		// Resolved here, not at render time: the position the track should start
		// at is "now", not whenever React last rendered.
		const intent = resolvePlaybackIntent(gameState, currentTrackId);
		const applied = appliedRef.current;

		// A failed track is only held back while the round keeps running: any
		// other intent hands the host a fresh attempt at it.
		if (intent.kind !== "play") applied.failedTrackId = undefined;

		if (intent.kind === "idle") return;

		if (intent.kind === "pause") {
			if (applied.kind === "pause") return;
			appliedRef.current = { kind: "pause" };
			spotifyPlayer.pause();
			return;
		}

		// Already playing this exact track — a re-render (volume change, error
		// toast, another player answering) must not restart it.
		if (applied.kind === "play" && applied.trackId === intent.trackId) return;
		if (applied.failedTrackId === intent.trackId) return;

		appliedRef.current = { kind: "play", trackId: intent.trackId };
		spotifyPlayer.resume(intent.trackId, intent.positionMs).then((started) => {
			if (started) return;

			// A newer intent already took over — its own result governs.
			const applied = appliedRef.current;
			if (applied.kind !== "play" || applied.trackId !== intent.trackId) return;

			// Remember the failure: reporting the error re-renders, which re-runs
			// this effect, and without this it would spin into a retry loop.
			appliedRef.current = { kind: undefined, failedTrackId: intent.trackId };
		});
	}, [isHost, spotifyPlayer, gameState, currentTrackId]);
}
