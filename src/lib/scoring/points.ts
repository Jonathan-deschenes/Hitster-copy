import { GameMode, type GameModeEnum } from "../../types/index.ts";

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

/**
 * How much of a correct answer's points can be earned back as a speed bonus
 * for answering early in the round: 0.5 means up to +50% for an instant
 * answer, decaying to +0% right at the round's deadline.
 */
export const SPEED_BONUS_RATIO = 0.5;

/**
 * Flat bonus for the 1st/2nd/3rd fastest player to score any points this
 * round, indexed by placement (index 0 = fastest). Deliberately not scaled
 * per mode like everything else here — the point is a stable, visible gap
 * between "you answered fastest" and "you didn't", the same size whether
 * the round happened to be Décennie (5 base) or Année (15 base). Flat
 * additive on top of `SPEED_BONUS_RATIO`'s continuous scaling — that one
 * rewards *how* fast, this rewards *how it ranked*, so both compound.
 */
export const RANK_BONUS: readonly number[] = [6, 3, 1];
