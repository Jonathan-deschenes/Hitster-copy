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

export function pickRandomRandomQuestion(
	record: Partial<Record<GameModeEnum, string>>,
): string | undefined {
	const keyToRemove = [GameMode.Titre];

	const keys = (Object.keys(record) as GameModeEnum[]).filter(
		(key) => !keyToRemove.includes(key),
	);
	if (keys.length === 0) return;

	const randomKey = keys[Math.floor(Math.random() * keys.length)];

	return record[randomKey];
}

/**
 * The question a round should display for a given mode: a random one when
 * the mode is "random", otherwise the mode's fixed question from
 * `gameModeQuestions` — falling back to `DEFAULT_QUESTION` if none is
 * defined for that mode.
 */
export function resolveGameQuestion(mode: string): string {
	if (mode === "random") {
		return pickRandomRandomQuestion(gameModeQuestions) ?? DEFAULT_QUESTION;
	}
	return gameModeQuestions[mode as GameModeEnum] ?? DEFAULT_QUESTION;
}
