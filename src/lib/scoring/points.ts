import { GameMode, type GameModeEnum } from "../../types";

/**
 * What a correct answer is worth, per mode. Weighted by how hard the mode is
 * to guess: pinning an exact release year is far harder than naming the
 * decade, so it pays three times as much.
 *
 * Modes absent from this table award nothing — `Album` is deliberately
 * unscored for now, and `Aleatoire` is never a target (it resolves to a real
 * mode before the round starts).
 */
export const MODE_POINTS: Partial<Record<GameModeEnum, number>> = {
	[GameMode.Annee]: 15,
	[GameMode.Musique]: 10,
	[GameMode.Titre]: 10,
	[GameMode.Artiste]: 8,
	[GameMode.Decennie]: 5,
};

/**
 * The consolation prize in the numeric modes: when nobody nails the exact
 * year or decade, whoever came closest still scores — but less than a player
 * who got it outright would have.
 */
export const CLOSEST_POINTS: Partial<Record<GameModeEnum, number>> = {
	[GameMode.Annee]: 7,
	[GameMode.Decennie]: 3,
};
