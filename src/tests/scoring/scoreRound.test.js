import { expect, test, describe } from 'vitest'
import { scoreRound } from "../../lib/scoring/scoreRound";
import { GameMode } from "../../types";

// Real entries from the app's "Jeux vidéo"/"Films et émission" playlists
// (fetched live from the deployed spotify-playlist edge function), or
// reconstructions of the exact bug reports filed against those playlists
// during a 60-round live playtest — not invented data.

const darkSouls = {
	id: "1",
	name: "DARK SOULS III Main Theme",
	artist: ["Motoi Sakuraba"],
	album: "Dark Souls 3 (Original Game Soundtrack)",
	duration: 180000,
	cover: null,
	releaseDate: "2016-04-11",
};

// Album text unrelated to the track name on purpose, so Musique partial
// credit can be tested in isolation without also matching via the album.
const sweetChild = {
	id: "2",
	name: "Sweet Child O' Mine",
	artist: ["Guns N' Roses"],
	album: "Appetite for Destruction",
	duration: 356000,
	cover: null,
	releaseDate: "1987-07-21",
};

// The exact real-catalog mismatch a player hit: the soundtrack album is
// branded "Tom Clancy's Siege" while the track itself is named after the
// game's actual, better-known name.
const rainbowSix = {
	id: "3",
	name: "Rainbow Six Siege Main Theme",
	artist: ["Ubisoft Sound Team"],
	album: "Tom Clancy's Siege (Original Game Soundtrack)",
	duration: 150000,
	cover: null,
	releaseDate: "2015-12-01",
};

function player(id, answer, answeredAt) {
	return { id, pseudo: id, host: false, score: 0, answer, answeredAt };
}

describe("Titre — exact vs partial vs none", () => {
	test("full title guessed correctly scores full points", () => {
		const results = scoreRound([player("a", "Dark Souls 3")], darkSouls, GameMode.Titre);
		expect(results.a).toEqual({ points: 10, correct: true });
	});

	test("franchise-only guess scores proportional partial credit", () => {
		const results = scoreRound([player("a", "Dark Souls")], darkSouls, GameMode.Titre);
		// "Dark Souls" covers 2 of the album's 3 words: round(10 * 0.5 * 2/3) = 3.
		expect(results.a).toEqual({ points: 3, correct: true });
	});

	test("wrong guess scores nothing", () => {
		const results = scoreRound([player("a", "Bloodborne")], darkSouls, GameMode.Titre);
		expect(results.a).toEqual({ points: 0, correct: false });
	});

	test("blank answer scores nothing", () => {
		const results = scoreRound([player("a", "")], darkSouls, GameMode.Titre);
		expect(results.a).toEqual({ points: 0, correct: false });
	});

	test("checks both the album and the track name — mismatched branding still scores", () => {
		// Album is "Tom Clancy's Siege"; the game is only recognizable by its
		// track name, "Rainbow Six Siege Main Theme" — "Main Theme" isn't
		// covered, so this is partial credit, not full, but it's no longer
		// the zero it used to be when only the album was checked.
		const results = scoreRound([player("a", "Rainbow Six Siege")], rainbowSix, GameMode.Titre);
		expect(results.a.correct).toBe(true);
		expect(results.a.points).toBeGreaterThan(0);
	});

	test("the album's own branding still scores directly", () => {
		const results = scoreRound([player("a", "Tom Clancy's Siege")], rainbowSix, GameMode.Titre);
		expect(results.a).toEqual({ points: 10, correct: true });
	});
});

describe("Musique — same engine, graded against the track name (and album as a fallback)", () => {
	test("exact track name", () => {
		const results = scoreRound([player("a", "Sweet Child O' Mine")], sweetChild, GameMode.Musique);
		expect(results.a).toEqual({ points: 10, correct: true });
	});

	test("opening words only score proportional partial credit", () => {
		const results = scoreRound([player("a", "Sweet Child")], sweetChild, GameMode.Musique);
		// Covers 2 of 4 words: round(10 * 0.5 * 2/4) = 3.
		expect(results.a).toEqual({ points: 3, correct: true });
	});

	test("wrong guess scores nothing", () => {
		const results = scoreRound([player("a", "November Rain")], sweetChild, GameMode.Musique);
		expect(results.a).toEqual({ points: 0, correct: false });
	});
});

describe("real bug reports from a 60-round live playtest", () => {
	test("Marvel's Spider-Man 2 — \"spider man\" scores partial credit", () => {
		const track = { ...darkSouls, album: "Marvel's Spider-Man 2 (Original Video Game Soundtrack)", name: "Spider-Man 2 Main Theme" };
		const results = scoreRound([player("a", "spider man")], track, GameMode.Titre);
		expect(results.a.correct).toBe(true);
		expect(results.a.points).toBeGreaterThan(0);
	});

	test("Marvel's Spider-Man 2 — \"spider man 2\" scores at least as much as \"spider man\"", () => {
		const track = { ...darkSouls, album: "Marvel's Spider-Man 2 (Original Video Game Soundtrack)", name: "Spider-Man 2 Main Theme" };
		const spiderMan = scoreRound([player("a", "spider man")], track, GameMode.Titre).a.points;
		const spiderMan2 = scoreRound([player("a", "spider man 2")], track, GameMode.Titre).a.points;
		expect(spiderMan2).toBeGreaterThanOrEqual(spiderMan);
	});

	test("FINAL FANTASY VII REBIRTH — \"final fantasy 7\" (Arabic for the Roman numeral) scores", () => {
		const track = { ...darkSouls, album: "FINAL FANTASY VII REBIRTH", name: "No Promises to Keep" };
		const results = scoreRound([player("a", "final fantasy 7")], track, GameMode.Titre);
		expect(results.a.correct).toBe(true);
		expect(results.a.points).toBeGreaterThan(0);
	});

	test("God of War II — \"2\" (Arabic for the Roman numeral) scores full credit", () => {
		const track = { ...darkSouls, album: "God of War II", name: "The Fields of Elysium" };
		const results = scoreRound([player("a", "god of war 2")], track, GameMode.Titre);
		expect(results.a).toEqual({ points: 10, correct: true });
	});

	test("The Sims 4, Vol. 2 — \"sims\" alone scores partial credit", () => {
		const track = { ...darkSouls, album: "The Sims 4, Vol. 2 (Original Game Soundtrack)", name: "Buy Mode" };
		const results = scoreRound([player("a", "sims")], track, GameMode.Titre);
		expect(results.a.correct).toBe(true);
		expect(results.a.points).toBeGreaterThan(0);
	});

	test("The Sims 4, Vol. 2 — \"sims 4\" scores more than bare \"sims\"", () => {
		const track = { ...darkSouls, album: "The Sims 4, Vol. 2 (Original Game Soundtrack)", name: "Buy Mode" };
		const sims = scoreRound([player("a", "sims")], track, GameMode.Titre).a.points;
		const sims4 = scoreRound([player("a", "sims 4")], track, GameMode.Titre).a.points;
		expect(sims4).toBeGreaterThan(sims);
	});

	test("Uncharted 2: Among Thieves — \"uncharted\" alone scores partial credit", () => {
		const track = { ...darkSouls, album: "Uncharted 2: Among Thieves (Original Soundtrack)", name: "Nate's Theme" };
		const results = scoreRound([player("a", "uncharted")], track, GameMode.Titre);
		expect(results.a.correct).toBe(true);
		expect(results.a.points).toBeGreaterThan(0);
	});

	test("Ori and the Will of the Wisps — dropping \"and the\" still scores partial credit", () => {
		const track = { ...darkSouls, album: "Ori and the Will of the Wisps (Original Soundtrack Recording)", name: "Main Theme" };
		const results = scoreRound([player("a", "Ori will of the wisp")], track, GameMode.Titre);
		expect(results.a.correct).toBe(true);
		expect(results.a.points).toBeGreaterThan(0);
	});

	test("Tom Clancy's Siege / Rainbow Six Siege Main Theme — both real names now score", () => {
		// "tom clancys siege" equals the album exactly (full credit); "rainbow
		// six siege" only covers the track name up to "Main Theme" (partial) —
		// both used to be zero when only the album was checked.
		const bySeries = scoreRound([player("a", "rainbow six siege")], rainbowSix, GameMode.Titre).a;
		const byAlbum = scoreRound([player("a", "tom clancys siege")], rainbowSix, GameMode.Titre).a;
		expect(bySeries.correct).toBe(true);
		expect(bySeries.points).toBeGreaterThan(0);
		expect(byAlbum).toEqual({ points: 10, correct: true });
	});

	test("TALES OF ARISE -Beyond the Dawn- — either half scores full credit", () => {
		const track = { ...darkSouls, album: "TALES OF ARISE -Beyond the Dawn-", name: "Title Theme" };
		const series = scoreRound([player("a", "Tales of Arise")], track, GameMode.Titre).a;
		const subtitle = scoreRound([player("a", "Beyond the Dawn")], track, GameMode.Titre).a;
		expect(series).toEqual({ points: 10, correct: true });
		expect(subtitle).toEqual({ points: 10, correct: true });
	});

	test("Destiny 2 — bare \"destiny\" scores partial credit", () => {
		const track = { ...darkSouls, album: "Destiny 2", name: "The Traveler" };
		const results = scoreRound([player("a", "destiny")], track, GameMode.Titre);
		expect(results.a.correct).toBe(true);
		expect(results.a.points).toBeGreaterThan(0);
	});

	test("Rainbow Road (Super Mario Kart Remix) — the rescued bracket content scores full credit", () => {
		const track = { ...darkSouls, album: "Rainbow Road (Super Mario Kart Remix)", name: "Rainbow Road" };
		const bracketOnly = scoreRound([player("a", "Super Mario Kart")], track, GameMode.Titre).a;
		const combined = scoreRound([player("a", "Rainbow Road Super Mario Kart")], track, GameMode.Titre).a;
		expect(bracketOnly).toEqual({ points: 10, correct: true });
		expect(combined).toEqual({ points: 10, correct: true });
	});
});

describe("Artiste — strict match, no partial credit", () => {
	test("full artist name scores full points", () => {
		const results = scoreRound([player("a", "Motoi Sakuraba")], darkSouls, GameMode.Artiste);
		expect(results.a).toEqual({ points: 8, correct: true });
	});

	test("a bare first name does not get partial credit — Artiste has no partial tier", () => {
		const results = scoreRound([player("a", "Motoi")], darkSouls, GameMode.Artiste);
		expect(results.a).toEqual({ points: 0, correct: false });
	});
});

describe("Album — deliberately unscored", () => {
	test("even the exact album name scores zero", () => {
		const results = scoreRound(
			[player("a", "Dark Souls 3 (Original Game Soundtrack)")],
			darkSouls,
			GameMode.Album,
		);
		expect(results.a).toEqual({ points: 0, correct: false });
	});
});

describe("Année — exact cancels the closest consolation for everyone", () => {
	const track = { ...darkSouls, releaseDate: "2016-04-11" };

	test("a lone exact guess scores the exact points", () => {
		const results = scoreRound([player("a", "2016")], track, GameMode.Annee);
		expect(results.a).toEqual({ points: 15, correct: true });
	});

	test("nobody exact — the closest guess(es) split the consolation prize", () => {
		const results = scoreRound([player("a", "2015"), player("b", "2010")], track, GameMode.Annee);
		expect(results.a).toEqual({ points: 7, correct: true });
		expect(results.b).toEqual({ points: 0, correct: false });
	});

	test("one exact guess cancels the closest consolation for everyone else", () => {
		const results = scoreRound([player("a", "2016"), player("b", "2015")], track, GameMode.Annee);
		expect(results.a).toEqual({ points: 15, correct: true });
		expect(results.b).toEqual({ points: 0, correct: false });
	});

	test("an unparseable answer sits the round out instead of losing", () => {
		const results = scoreRound([player("a", "je sais pas")], track, GameMode.Annee);
		expect(results.a).toEqual({ points: 0, correct: false });
	});
});

describe("Décennie — same shape as Année, smaller numbers", () => {
	const track = { ...darkSouls, releaseDate: "2016-04-11" };

	test("exact decade", () => {
		const results = scoreRound([player("a", "2010")], track, GameMode.Decennie);
		expect(results.a).toEqual({ points: 5, correct: true });
	});
});

describe("continuous time bonus", () => {
	const gameState = { duration: 20, roundStartedAt: 1000 };

	test("a solo player still gets the placement bonus on top (they're trivially fastest)", () => {
		const results = scoreRound([player("a", "Dark Souls 3", 1000)], darkSouls, GameMode.Titre, gameState);
		// base 10 + time bonus round(10*0.5*1)=5 + rank-1 bonus 6 = 21.
		expect(results.a).toEqual({ points: 21, correct: true });
	});

	test("answering right at the deadline earns no time bonus, but still ranks", () => {
		const results = scoreRound([player("a", "Dark Souls 3", 21000)], darkSouls, GameMode.Titre, gameState);
		// base 10 + time bonus 0 + rank-1 bonus 6 = 16.
		expect(results.a).toEqual({ points: 16, correct: true });
	});

	test("answering after the deadline clamps instead of going negative", () => {
		const results = scoreRound([player("a", "Dark Souls 3", 999999)], darkSouls, GameMode.Titre, gameState);
		expect(results.a).toEqual({ points: 16, correct: true });
	});

	test("no gameState skips only the time bonus — the rank bonus doesn't need a round clock", () => {
		const results = scoreRound([player("a", "Dark Souls 3", 3000)], darkSouls, GameMode.Titre);
		expect(results.a).toEqual({ points: 16, correct: true });
	});

	test("a player with no recorded answeredAt gets neither bonus", () => {
		const results = scoreRound([player("a", "Dark Souls 3", undefined)], darkSouls, GameMode.Titre, gameState);
		expect(results.a).toEqual({ points: 10, correct: true });
	});

	test("wrong answers never earn a bonus", () => {
		const results = scoreRound([player("a", "Bloodborne", 1000)], darkSouls, GameMode.Titre, gameState);
		expect(results.a).toEqual({ points: 0, correct: false });
	});
});

describe("rank bonus — 1st/2nd/3rd fastest scorer this round", () => {
	// 16s round so 25%/75%-elapsed land on exact floating-point fractions
	// instead of a binary-rounding artifact (e.g. 1 - 0.9 !== 0.1 in JS).
	const gameState = { duration: 16, roundStartedAt: 1000 };

	test("placement bonus decreases 1st > 2nd > 3rd, on top of the continuous time bonus", () => {
		const results = scoreRound(
			[
				player("first", "Dark Souls 3", 2000),
				player("second", "Dark Souls 3", 5000),
				player("third", "Dark Souls 3", 9000),
			],
			darkSouls,
			GameMode.Titre,
			gameState,
		);
		expect(results.first.points).toBeGreaterThan(results.second.points);
		expect(results.second.points).toBeGreaterThan(results.third.points);
	});

	test("4th place and beyond get no placement bonus, only the continuous time bonus", () => {
		const results = scoreRound(
			[
				player("a", "Dark Souls 3", 2000),
				player("b", "Dark Souls 3", 3000),
				player("c", "Dark Souls 3", 4000),
				player("d", "Dark Souls 3", 5000),
			],
			darkSouls,
			GameMode.Titre,
			gameState,
		);
		// d's total is exactly base + time bonus, no +1/+3/+6 placement add-on.
		const elapsedMs = 5000 - 1000;
		const durationMs = 16000;
		const expectedTimeBonus = Math.round(10 * 0.5 * (1 - elapsedMs / durationMs));
		expect(results.d.points).toBe(10 + expectedTimeBonus);
	});

	test("a fast wrong answer never earns a placement bonus", () => {
		const results = scoreRound(
			[player("fast", "Bloodborne", 1000), player("slow", "Dark Souls 3", 15000)],
			darkSouls,
			GameMode.Titre,
			gameState,
		);
		expect(results.fast).toEqual({ points: 0, correct: false });
		// The only actual scorer is trivially "1st" among scorers, despite
		// answering last in wall-clock time.
		expect(results.slow.points).toBeGreaterThan(10);
	});

	test("ranking is scoped to players who scored, not the whole lobby", () => {
		const results = scoreRound(
			[
				player("wrong", "Bloodborne", 1000),
				player("right", "Dark Souls 3", 2000),
			],
			darkSouls,
			GameMode.Titre,
			gameState,
		);
		// "right" is the only scorer, so they get rank-1 even though "wrong"
		// technically answered first.
		expect(results.right.points).toBe(10 + Math.round(10 * 0.5 * (1 - 1000 / 16000)) + 6);
	});
});
