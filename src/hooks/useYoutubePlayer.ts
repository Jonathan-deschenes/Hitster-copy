import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StorageKeys, StorageUtility } from "./useStorage";
import {
	createYoutubePlayer,
	describeYoutubeError,
	loadYoutubeIframeApi,
} from "../lib/youtube/player";

interface UseYoutubePlayerOptions {
	enabled: boolean;
}

const DEFAULT_VOLUME = 0.3;
const NOT_READY_MESSAGE = "Lecteur YouTube pas encore prêt, réessaie dans un instant.";

function readStoredVolume(): number {
	const raw = StorageUtility.getItem<number>(StorageKeys.YOUTUBE_VOLUME);
	return typeof raw === "number" && raw >= 0 && raw <= 1 ? raw : DEFAULT_VOLUME;
}

/**
 * Owns this tab's YouTube IFrame player. Unlike the old Spotify device, this
 * needs no cross-page singleton — there's no server-side device to race on
 * teardown — so a plain component-owned instance (created while `enabled`,
 * destroyed on unmount) is enough. Call unconditionally, gate with `enabled`.
 */
/** In-progress attempt to play one of a track's candidate video ids. */
interface PlaybackAttempt {
	candidates: string[];
	index: number;
	positionSeconds: number;
}

export function useYoutubePlayer({ enabled }: UseYoutubePlayerOptions) {
	const playerRef = useRef<YT.Player | null>(null);
	// Not React state: advancing through candidates happens inside the
	// player's own onError callback, entirely outside the render cycle.
	const attemptRef = useRef<PlaybackAttempt | null>(null);
	const [isReady, setIsReady] = useState(false);
	const [isUnlocked, setIsUnlocked] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [volume, setVolumeState] = useState(() => readStoredVolume());

	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		// Read fresh rather than closing over the `volume` state, so this effect
		// only needs to depend on `enabled` — reacting to `volume` here would
		// tear down and recreate the player on every slider drag.
		const initialVolume = readStoredVolume();

		loadYoutubeIframeApi().then(() => {
			if (cancelled) return;
			const player = createYoutubePlayer({
				onReady: () => {
					player.setVolume(Math.round(initialVolume * 100));
					setIsReady(true);
				},
				// A candidate can fail for reasons the search filter didn't catch
				// (embedding disabled, region-locked, taken down) — try the next
				// one silently instead of leaving the round with no audio at all.
				onError: (event) => {
					const attempt = attemptRef.current;
					if (attempt && attempt.index < attempt.candidates.length - 1) {
						attempt.index += 1;
						player.loadVideoById(
							attempt.candidates[attempt.index],
							attempt.positionSeconds,
						);
						return;
					}
					attemptRef.current = null;
					setError(describeYoutubeError(event.data));
				},
			});
			playerRef.current = player;
		});

		return () => {
			cancelled = true;
			playerRef.current?.destroy();
			playerRef.current = null;
			attemptRef.current = null;
			setIsReady(false);
			setIsUnlocked(false);
		};
	}, [enabled]);

	const pause = useCallback(async () => {
		playerRef.current?.pauseVideo();
	}, []);

	/**
	 * Picks the round's track back up at `positionSeconds`, trying `candidates`
	 * in order until one actually plays — see the `onError` fallback above.
	 * Resumes in place (no seek) when this player already holds one of them —
	 * pausing doesn't move its position, and `resumeRound` rewinds
	 * `roundStartedAt` so the freshly computed position matches where it was
	 * paused. Otherwise loads the first candidate fresh at the given position.
	 */
	const resume = useCallback(
		async (candidates: string[], positionSeconds = 0): Promise<boolean> => {
			const player = playerRef.current;
			if (!player || candidates.length === 0) {
				setError(NOT_READY_MESSAGE);
				return false;
			}

			let currentVideoId: string | undefined;
			try {
				currentVideoId = player.getVideoData().video_id;
			} catch {
				currentVideoId = undefined;
			}

			if (currentVideoId && candidates.includes(currentVideoId)) {
				attemptRef.current = null;
				player.playVideo();
				return true;
			}

			attemptRef.current = { candidates, index: 0, positionSeconds };
			player.loadVideoById(candidates[0], positionSeconds);
			return true;
		},
		[],
	);

	/**
	 * The user gesture browsers require before the first audio: this **is**
	 * the round's actual first playback attempt, not a separate priming step —
	 * calling `playVideo()`/`pauseVideo()` on a player with nothing cued was
	 * exactly the "invalid parameter" error this used to throw immediately.
	 * Callers only offer this once real `candidates` exist (see
	 * `Game.tsx`'s `canUnlock`), so this never fires empty.
	 */
	const unlock = useCallback(
		async (candidates: string[], positionSeconds = 0) => {
			if (candidates.length === 0) return;
			setIsUnlocked(true);
			await resume(candidates, positionSeconds);
		},
		[resume],
	);

	const setVolume = useCallback((next: number) => {
		const clamped = Math.min(1, Math.max(0, next));
		StorageUtility.setItem(StorageKeys.YOUTUBE_VOLUME, clamped);
		setVolumeState(clamped);
		playerRef.current?.setVolume(Math.round(clamped * 100));
	}, []);

	return useMemo(
		() => ({
			isReady,
			isUnlocked,
			unlock,
			error,
			pause,
			resume,
			volume,
			setVolume,
		}),
		[isReady, isUnlocked, unlock, error, pause, resume, volume, setVolume],
	);
}

/**
 * The memoized handle above. Hooks that receive it must take the **whole**
 * object: a narrowed literal changes identity every render and would re-run
 * the playback reconciler continuously.
 */
export type youtubePlayerHandleProps = ReturnType<typeof useYoutubePlayer>;
