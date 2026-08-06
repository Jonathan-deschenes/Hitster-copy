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
