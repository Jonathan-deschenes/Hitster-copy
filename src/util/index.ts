import {
	GameMode,
	type gameCategoryProps,
	type GameModeEnum,
	type gameStateProps,
	type playerProps,
} from "../types";
import {
	DEFAULT_QUESTION,
	gameModeOptions,
	gameModeQuestions,
	TITLE_ONLY_PLAYLISTS,
} from "../constants/createGameOptions";

/**
 * Players sorted by score, each keeping the index it had in the *unsorted*
 * list — `PlayerAvatar` picks its gradient from that, so it must not shuffle
 * as the standings move.
 */
export function rankPlayers(players: playerProps[]) {
	return players
		.map((player, toneIndex) => ({ player, toneIndex }))
		.sort((a, b) => (b.player.score ?? 0) - (a.player.score ?? 0))
		.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Whether the round in `game_state` is the last one the game will play — the
 * host's "manche suivante" becomes "classement final" from here.
 *
 * The queue length bounds it too: a playlist that yielded fewer tracks than
 * `totalRounds` would otherwise replay its last track forever, since
 * `startRound` clamps `current` to the queue.
 */
export function isFinalRound(
	gameState?: gameStateProps,
	queueLength?: number,
): boolean {
	if (!gameState) return false;

	const lastRound = queueLength
		? Math.min(gameState.totalRounds, queueLength)
		: gameState.totalRounds;

	return gameState.round + 1 >= lastRound;
}

export function playerDisplayName(pseudo: string, isYou = false) {
	return `${pseudo || "Anonyme"}${isYou ? " (toi)" : ""}`;
}

/**
 * Modes offerable for a playlist. Soundtrack playlists only support `Titre`
 * ("where is this music from?"); everywhere else `Titre` is dropped instead,
 * since it has no answer for a regular song.
 */
export function filterGameModesForCategory(
	categoryValue: string,
): gameCategoryProps[] {
	return TITLE_ONLY_PLAYLISTS.has(categoryValue)
		? gameModeOptions.filter((mode) => mode.value === GameMode.Titre)
		: gameModeOptions.slice(0, -1);
}

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
