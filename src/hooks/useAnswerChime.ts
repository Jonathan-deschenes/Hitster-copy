import { useEffect, useRef } from "react";

interface UseAnswerChimeParams {
	answeredCount: number;
	/** Host-only in practice — the chime tracks answers coming in. */
	enabled: boolean;
}

/**
 * Pops a sound each time one more player has answered. The audio element is
 * reused: the clip is short and this is the app's only effect.
 */
export function useAnswerChime({ answeredCount, enabled }: UseAnswerChimeParams) {
	const popRef = useRef<HTMLAudioElement | null>(null);
	const answeredCountRef = useRef<number | null>(null);

	useEffect(() => {
		const previousCount = answeredCountRef.current;
		answeredCountRef.current = answeredCount;

		// `null` is the first observation (joining a round already under way
		// mustn't replay every answer), and a decrease is the reset between
		// rounds — only a new answer makes a sound.
		if (previousCount === null || answeredCount <= previousCount) return;
		if (!enabled) return;

		const pop = (popRef.current ??= new Audio("/sound/pop.mp3"));
		pop.currentTime = 0;
		// Browsers block autoplay until the page has been interacted with.
		pop.play().catch(() => {});
	}, [answeredCount, enabled]);
}
