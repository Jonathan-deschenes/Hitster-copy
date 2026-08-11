import { GameMode, type GameModeEnum, type playerProps } from "../types";
import {
	DEFAULT_QUESTION,
	gameModeQuestions,
} from "../constants/createGameOptions";

export function pickRandomOtherPlayer(
	players: playerProps[],
	currentPlayerId: string,
) {
	if (players.length < 2) return null;
	const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
	let randomIndex = Math.floor(Math.random() * players.length);
	if (randomIndex === currentIndex)
		randomIndex = (randomIndex + 1) % players.length;
	return players[randomIndex];
}

/**
 * Deterministic pick (lowest id) instead of random: every connected client
 * computes this independently from the same synced player list, so exactly
 * one of them ends up being "the" successor without needing to coordinate.
 */
export function pickSuccessorPlayer(
	players: playerProps[],
	excludePlayerId: string,
) {
	const remaining = [...players]
		.filter((p) => p.id !== excludePlayerId)
		.sort((a, b) => a.id.localeCompare(b.id));
	return remaining[0] ?? null;
}

/**
 * Modes `Aleatoire` never draws: `Titre` only makes sense on soundtrack
 * playlists, and `Album` isn't scored, so landing on either at random would
 * hand players an unwinnable round.
 */
const RANDOM_MODE_EXCLUSIONS: GameModeEnum[] = [GameMode.Titre, GameMode.Album];

export function pickRandomQuestionMode(
	record: Partial<Record<GameModeEnum, string>>,
): GameModeEnum | undefined {
	const keys = (Object.keys(record) as GameModeEnum[]).filter(
		(key) => !RANDOM_MODE_EXCLUSIONS.includes(key),
	);
	if (keys.length === 0) return;

	return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * The question a round should display for a given mode, together with the
 * mode that question is actually about. The two differ under `Aleatoire`,
 * where the target is drawn per round — and the scorer needs that resolved
 * mode, so both halves get persisted in `game_state`.
 */
export function resolveGameQuestion(mode: string): {
	question: string;
	questionMode: GameModeEnum;
} {
	const questionMode =
		mode === GameMode.Aleatoire
			? (pickRandomQuestionMode(gameModeQuestions) ?? GameMode.Musique)
			: (mode as GameModeEnum);

	return {
		question: gameModeQuestions[questionMode] ?? DEFAULT_QUESTION,
		questionMode,
	};
}
