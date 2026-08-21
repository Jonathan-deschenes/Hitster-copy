import { GameMode } from "../../types/index.ts";
import type {
	GameModeEnum,
	gameStateProps,
	musicItemsProps,
	playerProps,
} from "../../types/index.ts";
import { isTextMatch, matchTitleTier, PARTIAL_MAX_RATIO } from "./normalize.ts";
import {
	decadeOf,
	parseAnswerDecade,
	parseAnswerYear,
	parseReleaseYear,
} from "./parse.ts";
import {
	CLOSEST_POINTS,
	MODE_POINTS,
	RANK_BONUS,
	SPEED_BONUS_RATIO,
} from "./points.ts";

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
 * Rewards answering early: up to `SPEED_BONUS_RATIO` extra, scaled by how
 * much of the round's configured duration was left when the player
 * answered. Applies uniformly to whatever `results` already holds — exact
 * and partial title/song matches, artist matches, numeric exact-or-closest
 * guesses alike — so it also breaks the numeric modes' pre-existing ties
 * between simultaneous exact (or simultaneous closest) guesses.
 *
 * Silently skips a player when there's nothing to time against: an older
 * lobby row with no `roundStartedAt`, or a player who scored without a
 * recorded `answeredAt`.
 */
function applyTimeBonus(
	results: Record<string, roundResultProps>,
	players: playerProps[],
	gameState: gameStateProps | undefined,
) {
	const roundStartedAt = gameState?.roundStartedAt;
	if (roundStartedAt == null) return;

	const durationMs = (gameState?.duration ?? 30) * 1000;
	if (durationMs <= 0) return;

	for (const player of players) {
		const result = results[player.id];
		if (!result || result.points <= 0) continue;
		if (player.answeredAt == null) continue;

		const elapsedMs = Math.min(
			durationMs,
			Math.max(0, player.answeredAt - roundStartedAt),
		);
		const remainingFraction = 1 - elapsedMs / durationMs;
		const bonus = Math.round(result.points * SPEED_BONUS_RATIO * remainingFraction);
		if (bonus > 0) result.points += bonus;
	}
}

/**
 * A flat, mode-independent bonus for the 1st/2nd/3rd player to score any
 * points this round, by answer order. Over a long game the continuous
 * time bonus above barely separates two "fast" answers a couple of seconds
 * apart — a flat placement bonus gives a bigger, more consistent gap that
 * stays visible over many rounds, on top of (not instead of) the continuous
 * one. Ranked purely by `answeredAt`, independent of the round clock, so it
 * still applies even without a `gameState`/`roundStartedAt` to time against.
 */
function applyRankBonus(
	results: Record<string, roundResultProps>,
	players: playerProps[],
) {
	const scorers = players
		.filter((player) => (results[player.id]?.points ?? 0) > 0 && player.answeredAt != null)
		.sort((a, b) => (a.answeredAt as number) - (b.answeredAt as number));

	scorers.forEach((player, place) => {
		const bonus = RANK_BONUS[place];
		if (bonus) results[player.id].points += bonus;
	});
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
	gameState?: gameStateProps,
): Record<string, roundResultProps> {
	const results: Record<string, roundResultProps> = {};
	for (const player of players) {
		results[player.id] = { ...NO_POINTS };
	}

	const points = MODE_POINTS[questionMode];
	if (!track || !points) return results;

	if (questionMode === GameMode.Annee) {
		scoreNumericMode(
			players,
			results,
			parseReleaseYear(track.releaseDate),
			parseAnswerYear,
			points,
			CLOSEST_POINTS[questionMode] ?? 0,
		);
	} else if (questionMode === GameMode.Decennie) {
		const year = parseReleaseYear(track.releaseDate);
		scoreNumericMode(
			players,
			results,
			year === null ? null : decadeOf(year),
			parseAnswerDecade,
			points,
			CLOSEST_POINTS[questionMode] ?? 0,
		);
	} else if (
		questionMode === GameMode.Titre ||
		questionMode === GameMode.Musique
	) {
		// Graded against both the album and the track name — Spotify sometimes
		// tells two different stories about what a track "is" ("Tom Clancy's
		// Siege" the soundtrack album next to "Rainbow Six Siege Main Theme"
		// the track itself), so either recognizable name should score. A
		// franchise-prefix or opening-words-only answer still counts, scaled
		// down by how much of the matched name it actually covered.
		for (const player of players) {
			const { tier, ratio } = matchTitleTier(player.answer, track.album, track.name);
			if (tier === "exact") results[player.id] = { points, correct: true };
			else if (tier === "partial") {
				const partialPoints = Math.round(points * PARTIAL_MAX_RATIO * ratio);
				if (partialPoints > 0) {
					results[player.id] = { points: partialPoints, correct: true };
				}
			}
		}
	} else {
		// Artiste: any of the credited artists is enough, matched strictly —
		// a bare first word shouldn't count as the whole artist name.
		const targets = track.artist ?? [];
		for (const player of players) {
			const matched = targets.some((target) => isTextMatch(player.answer, target));
			if (matched) results[player.id] = { points, correct: true };
		}
	}

	applyTimeBonus(results, players, gameState);
	applyRankBonus(results, players);

	return results;
}
