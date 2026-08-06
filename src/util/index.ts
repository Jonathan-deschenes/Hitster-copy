import type { playerProps } from "../types";

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
