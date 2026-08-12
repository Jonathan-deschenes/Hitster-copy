import { GameMode } from "../../types";
import type { GameModeEnum, musicItemsProps, playerProps } from "../../types";
import { isTextMatch, isTitleMatch } from "./normalize";
import {
	decadeOf,
	parseAnswerDecade,
	parseAnswerYear,
	parseReleaseYear,
} from "./parse";
import { CLOSEST_POINTS, MODE_POINTS } from "./points";

export type roundResultProps = {
	/** Points won this round. Added on top of the running score by the caller. */
	points: number;
	/** Whether the answer counted — true for a closest-guess win too. */
	correct: boolean;
};

const NO_POINTS: roundResultProps = { points: 0, correct: false };

/**
 * The answer the round was looking for, in a form worth showing players
 * during the reveal. Shares its per-mode switch with the scorer so the
 * displayed answer can never drift from the one that was actually graded.
 */
export function expectedAnswer(
	track: musicItemsProps | undefined,
	questionMode: GameModeEnum,
): string {
	if (!track) return "";

	switch (questionMode) {
		case GameMode.Artiste:
			return track.artist?.join(", ") ?? "";
		// The soundtrack album is what carries the film or game name.
		case GameMode.Titre:
		case GameMode.Album:
			return track.album ?? "";
		case GameMode.Annee:
			return String(parseReleaseYear(track.releaseDate) ?? "");
		case GameMode.Decennie: {
			const year = parseReleaseYear(track.releaseDate);
			return year === null ? "" : `Années ${decadeOf(year)}`;
		}
		default:
			return track.name ?? "";
	}
}

/**
 * Grades a numeric mode across the whole table at once, because the outcome
 * is not per-player: an exact hit by anyone cancels the closest-guess
 * consolation for everyone else.
 */
function scoreNumericMode(
	players: playerProps[],
	results: Record<string, roundResultProps>,
	target: number | null,
	parseAnswer: (answer: string | undefined) => number | null,
	exactPoints: number,
	closestPoints: number,
) {
	if (target === null) return results;

	const guesses: { id: string; value: number }[] = [];
	for (const player of players) {
		const value = parseAnswer(player.answer);
		// Unparseable answers ("je sais pas", blank) sit the round out
		// entirely rather than counting as an infinitely distant guess.
		if (value !== null) guesses.push({ id: player.id, value });
	}
	if (guesses.length === 0) return results;

	const exact = guesses.filter((guess) => guess.value === target);
	if (exact.length > 0) {
		for (const guess of exact) {
			results[guess.id] = { points: exactPoints, correct: true };
		}
		return results;
	}

	if (closestPoints <= 0) return results;

	const distances = guesses.map((guess) => Math.abs(guess.value - target));
	const closest = Math.min(...distances);
	guesses.forEach((guess, index) => {
		if (distances[index] === closest) {
			results[guess.id] = { points: closestPoints, correct: true };
		}
	});

	return results;
}

/**
 * Grades every player's answer for the round that just ended.
 *
 * Always returns an entry per player, so callers never have to handle a
 * missing result. A player scores nothing — without it being an error — when
 * there is no track, when the mode awards no points (`Album`), or when their
 * answer is blank or wrong.
 */
export function scoreRound(
	players: playerProps[],
	track: musicItemsProps | undefined,
	questionMode: GameModeEnum,
): Record<string, roundResultProps> {
	const results: Record<string, roundResultProps> = {};
	for (const player of players) {
		results[player.id] = { ...NO_POINTS };
	}

	const points = MODE_POINTS[questionMode];
	if (!track || !points) return results;

	if (questionMode === GameMode.Annee) {
		return scoreNumericMode(
			players,
			results,
			parseReleaseYear(track.releaseDate),
			parseAnswerYear,
			points,
			CLOSEST_POINTS[questionMode] ?? 0,
		);
	}

	if (questionMode === GameMode.Decennie) {
		const year = parseReleaseYear(track.releaseDate);
		return scoreNumericMode(
			players,
			results,
			year === null ? null : decadeOf(year),
			parseAnswerDecade,
			points,
			CLOSEST_POINTS[questionMode] ?? 0,
		);
	}

	// Any of the credited artists is enough; the other text modes have a
	// single target.
	const targets =
		questionMode === GameMode.Artiste
			? (track.artist ?? [])
			: [expectedAnswer(track, questionMode)];

	// Titre grades against the album, which routinely tacks a subtitle or
	// numeral onto the franchise name — tolerate a correct, shorter answer
	// there. Musique/Artiste keep the stricter match: a bare first word
	// shouldn't count as the whole song or artist name.
	const matchesTarget =
		questionMode === GameMode.Titre ? isTitleMatch : isTextMatch;

	for (const player of players) {
		const matched = targets.some((target) =>
			matchesTarget(player.answer, target),
		);
		if (matched) results[player.id] = { points, correct: true };
	}

	return results;
}
