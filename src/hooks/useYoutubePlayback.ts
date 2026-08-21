import { useEffect, useMemo, useRef } from "react";
import type { gameStateProps, playbackTrackProps } from "../types";
import { resolvePlaybackIntent } from "../lib/playback";
import type { PlaybackIntent } from "../lib/playback";
import { showToast } from "../lib/toast";
import type { youtubePlayerHandleProps } from "./useYoutubePlayer";

interface UseYoutubePlaybackParams {
	gameState?: gameStateProps;
	currentTrack?: playbackTrackProps;
	/** The whole memoized handle: a narrowed literal would re-run the reconciler every render. */
	youtubePlayer: youtubePlayerHandleProps;
}

/**
 * Drives this tab's YouTube player from the lobby row — for every player, not
 * just the host. That's the entire point of moving off Spotify Connect: each
 * client produces its own audio instead of only one shared device's.
 *
 * A reconciler, not a state machine: `resolvePlaybackIntent` derives what the
 * player should be doing from the row alone and has no memory, so every tab
 * reaches the same conclusion independently — there's no host-handoff
 * bookkeeping to get wrong here, unlike the old `useHostPlayback`.
 */
export function useYoutubePlayback({
	gameState,
	currentTrack,
	youtubePlayer,
}: UseYoutubePlaybackParams) {
	useEffect(() => {
		if (youtubePlayer.error) showToast(youtubePlayer.error, "error");
	}, [youtubePlayer.error]);

	// What this player has already been told to do, so an identical intent
	// issues no command. Only dedupes — the intent itself is re-derived from
	// the row every run. Falling back between candidates for a track that
	// fails to load is `useYoutubePlayer`'s job, not this reconciler's — once
	// applied here, a track is left alone regardless of whether it eventually
	// played, which is exactly what keeps this from retrying every re-render.
	const appliedRef = useRef<{
		kind?: PlaybackIntent["kind"];
		trackId?: string;
	}>({});

	// The first candidate stands in for "this track" for dedup purposes —
	// `resolvePlaybackIntent` only needs a stable identity, not the one that
	// actually ends up playing.
	const rawCandidateIds = currentTrack?.youtubeIds ?? [];
	const currentTrackId = rawCandidateIds[0];

	// Stable identity across renders that don't change track: `currentTrack`
	// is a new object every realtime broadcast (another player answering is
	// enough), which would otherwise make `candidateIds` a fresh array every
	// time and re-run the effect below far more than needed. Deliberately
	// keyed on `currentTrackId` alone, not `rawCandidateIds` — the list for a
	// given track id never changes mid-round, so this is a real content-stable
	// key the linter can't see.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const candidateIds = useMemo(() => rawCandidateIds, [currentTrackId]);

	useEffect(() => {
		if (!youtubePlayer.isReady || !youtubePlayer.isUnlocked || !gameState) return;

		// Resolved here, not at render time: the position the track should
		// start at is "now", not whenever React last rendered.
		const intent = resolvePlaybackIntent(gameState, currentTrackId);
		const applied = appliedRef.current;

		if (intent.kind === "idle") return;

		if (intent.kind === "pause") {
			if (applied.kind === "pause") return;
			appliedRef.current = { kind: "pause" };
			youtubePlayer.pause();
			return;
		}

		// Already playing this exact track — a re-render (volume change, error
		// toast, another player answering) must not restart it.
		if (applied.kind === "play" && applied.trackId === intent.trackId) return;

		appliedRef.current = { kind: "play", trackId: intent.trackId };
		youtubePlayer.resume(candidateIds, intent.positionMs / 1000);
	}, [youtubePlayer, gameState, currentTrackId, candidateIds]);
}
