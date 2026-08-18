import { expect, test, describe } from 'vitest'
import { matchTitleTier } from "../../lib/scoring/normalize";

// matchTitleTier now returns { tier, ratio } instead of a bare tier string —
// `ratio` only matters for "partial" (it drives proportional partial
// credit in scoreRound.ts). `tier(...)` below is just a readability helper.
function tier(...args) {
	return matchTitleTier(...args).tier;
}

// Every target string below is a real Spotify `album`/`name` value from the
// app's own "Jeux vidéo"/"Films et émission" playlists, or a reconstruction
// of a real bug report against those playlists during a live 60-round
// playtest — not invented data.

describe("exact — full title, typo-tolerant, either candidate", () => {
	test("verbatim match", () => {
		expect(tier("Halo: Combat Evolved", "Halo: Combat Evolved (Original Soundtrack)")).toBe("exact");
	});

	test("case/accent-insensitive", () => {
		expect(tier("GOD OF WAR RAGNAROK", "God of War Ragnarök")).toBe("exact");
	});

	test("pure OST decoration with no real subtitle still matches on the franchise alone", () => {
		expect(tier("halo", "Halo: Original Soundtrack")).toBe("exact");
	});

	test("bare franchise name matches the pre-colon segment of a real subtitle", () => {
		expect(tier("halo", "Halo: Combat Evolved (Original Soundtrack)")).toBe("exact");
	});

	test("possessive apostrophe dropped by the player still counts (typo, not partial)", () => {
		expect(tier("marvel spider man", "Marvel's Spider-Man: Miles Morales")).toBe("exact");
	});

	test("Roman numeral in the source data matches an Arabic guess", () => {
		expect(tier("god of war 2", "God of War II")).toBe("exact");
	});

	test("a bracket-decorated album's clean title still matches exactly", () => {
		expect(tier("rainbow road", "Rainbow Road (Super Mario Kart Remix)")).toBe("exact");
	});

	test("rescued bracket content alone matches exactly", () => {
		expect(tier("super mario kart", "Rainbow Road (Super Mario Kart Remix)")).toBe("exact");
	});

	test("primary title plus rescued bracket content, combined, matches exactly", () => {
		expect(tier("rainbow road super mario kart", "Rainbow Road (Super Mario Kart Remix)")).toBe("exact");
	});

	test("the album's own branding matches exactly", () => {
		const album = "Tom Clancy's Siege (Original Game Soundtrack)";
		const name = "Rainbow Six Siege Main Theme";
		expect(matchTitleTier("tom clancys siege", album, name).tier).toBe("exact");
	});

	test("hugging-dash subtitle (\"TITLE -Subtitle-\", no space after the dash) splits like a colon would", () => {
		expect(tier("beyond the dawn", "TALES OF ARISE -Beyond the Dawn-")).toBe("exact");
	});

	test("hugging-dash franchise half also matches", () => {
		expect(tier("tales of arise", "TALES OF ARISE -Beyond the Dawn-")).toBe("exact");
	});
});

describe("partial — proportional credit for franchise/opening-words-only guesses", () => {
	test("missing the branding prefix, matched mid-string (Spider-Man)", () => {
		const result = matchTitleTier("spider man", "Marvel's Spider-Man 2 (Original Video Game Soundtrack)");
		expect(result.tier).toBe("partial");
		expect(result.ratio).toBeGreaterThan(0);
	});

	test("missing only the branding prefix, one word away from the full title (Spider-Man 2)", () => {
		// "spider man 2" covers 3 of "marvels spider man 2"'s 4 words —
		// closer than "spider man" alone, but still short of exact.
		const bare = matchTitleTier("spider man", "Marvel's Spider-Man 2");
		const withNumber = matchTitleTier("spider man 2", "Marvel's Spider-Man 2");
		expect(withNumber.tier).toBe("partial");
		expect(withNumber.ratio).toBeGreaterThan(bare.ratio);
	});

	test("Roman-to-Arabic conversion lets a franchise-only guess partially match (Final Fantasy)", () => {
		const result = matchTitleTier("final fantasy 7", "FINAL FANTASY VII REBIRTH");
		expect(result.tier).toBe("partial");
	});

	test("checked against the track name when the album tells a different story (Rainbow Six)", () => {
		// Real catalog mismatch: album is branded "Tom Clancy's Siege", the
		// game is only recognizable by its track name's own wording.
		const album = "Tom Clancy's Siege (Original Game Soundtrack)";
		const name = "Rainbow Six Siege Main Theme";
		const result = matchTitleTier("rainbow six siege", album, name);
		expect(result.tier).toBe("partial");
		expect(result.ratio).toBeGreaterThan(0);
	});

	test("bare franchise word alone, four letters or more, is eligible on its own (Sims)", () => {
		const result = matchTitleTier("sims", "The Sims 4, Vol. 2 (Original Game Soundtrack)");
		expect(result.tier).toBe("partial");
	});

	test("\"the sims\" (with the leading article) scores the same as \"sims\"", () => {
		const withArticle = matchTitleTier("the sims", "The Sims 4, Vol. 2 (Original Game Soundtrack)");
		const bare = matchTitleTier("sims", "The Sims 4, Vol. 2 (Original Game Soundtrack)");
		expect(withArticle).toEqual(bare);
	});

	test("more of the real name covered scores strictly more partial credit (Sims 4 > Sims alone)", () => {
		const target = "The Sims 4, Vol. 2 (Original Game Soundtrack)";
		const sims = matchTitleTier("sims", target);
		const sims4 = matchTitleTier("sims 4", target);
		expect(sims4.tier).toBe("partial");
		expect(sims4.ratio).toBeGreaterThan(sims.ratio);
	});

	test("franchise name only, missing the subtitle (Uncharted)", () => {
		const result = matchTitleTier("uncharted", "Uncharted 2: Among Thieves (Original Soundtrack)");
		expect(result.tier).toBe("partial");
	});

	test("dropping a filler word (\"and\") mid-phrase still gets credit (Ori and the Will of the Wisps)", () => {
		const result = matchTitleTier("ori will of the wisp", "Ori and the Will of the Wisps (Original Soundtrack Recording)");
		expect(result.tier).toBe("partial");
	});

	test("the same track's cleaner partial answer still works too", () => {
		const result = matchTitleTier("ori and the will", "Ori and the Will of the Wisps (Original Soundtrack Recording)");
		expect(result.tier).toBe("partial");
	});

	test("bare franchise word alone, from the hugging-dash title, is a partial (not exact) match", () => {
		// "tales" (5 letters, clears the single-word length gate) is only 1 of
		// "tales of arise"'s 3 content words — the segment match itself (the
		// full "Tales of Arise" half) is "exact", tested separately above.
		const result = matchTitleTier("tales", "TALES OF ARISE -Beyond the Dawn-");
		expect(result.tier).toBe("partial");
	});

	test("bare franchise word, missing the sequel number (Destiny)", () => {
		const result = matchTitleTier("destiny", "Destiny 2");
		expect(result.tier).toBe("partial");
	});

	test("guess includes the literal word \"remix\" — not stripped from freeform answer text, so it's an extra word, not a bonus", () => {
		// Unlike the bracket's own "Remix" (decoration, stripped when building
		// the rescued candidate), a player typing "remix" adds a word the
		// candidate doesn't have — full coverage of the candidate plus
		// padding, which stays "partial" rather than promoting to "exact".
		const result = matchTitleTier("super mario kart remix", "Rainbow Road (Super Mario Kart Remix)");
		expect(result.tier).toBe("partial");
		expect(result.ratio).toBe(1);
	});
});

describe("none — correctly rejected, not a false positive", () => {
	test("two unrelated games that happen to share two words are not conflated", () => {
		expect(tier("outer wilds", "The Outer Worlds (Original Soundtrack)")).toBe("none");
	});

	test("reverse direction of the same pair", () => {
		expect(tier("outer worlds", "Outer Wilds (Original Soundtrack)")).toBe("none");
	});

	test("a short filler-length single word never blanket-matches (word-length gate)", () => {
		expect(tier("war", "God of War Ragnarök")).toBe("none");
	});

	test("completely unrelated title", () => {
		expect(tier("minecraft", "Halo: Combat Evolved (Original Soundtrack)")).toBe("none");
	});

	test("blank answer never matches", () => {
		expect(tier("", "Halo: Combat Evolved (Original Soundtrack)")).toBe("none");
	});

	test("blank target never matches", () => {
		expect(tier("halo", "")).toBe("none");
	});

	test("no targets at all never matches", () => {
		expect(matchTitleTier("halo").tier).toBe("none");
	});
});
