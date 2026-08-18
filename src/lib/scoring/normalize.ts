/**
 * Text comparison for the free-text game modes (title, source, artist, album).
 *
 * Players type answers on a phone, in a hurry, against Spotify metadata that
 * is full of decoration they never hear: "- Remastered 2011", "(feat. X)",
 * "(From \"Shrek\")". Comparing raw strings would reject almost every honest
 * answer, so both sides get reduced to their recognisable core first and are
 * then matched with a small typo tolerance.
 */

/** Answers this close to the target count as correct (1 = identical). */
const SIMILARITY_THRESHOLD = 0.85;

/**
 * How much of a full-tier match a "partial" (franchise/opening-words-only)
 * match can be worth at best — scaled further down by how much of the
 * target's content the answer actually covered. See `evaluateCandidate`.
 */
export const PARTIAL_MAX_RATIO = 0.5;

/**
 * Decoration Spotify appends to track and album names. Matched against the
 * contents of a bracketed group or of a trailing " - " segment — never
 * against the middle of a title, so "Live and Let Die" survives while
 * "Live at Wembley" as a suffix does not. `sound\s*track` also catches
 * "SOUND TRACK" written as two words, which several game OST albums do.
 */
const NOISE =
	/^(.*\b)?(remaster|remastered|live|mono|stereo|radio edit|single version|album version|deluxe|edition|bonus|anniversary|demo|instrumental|karaoke|reprise|mix|remix|edit|version|from|original motion picture|original soundtrack|sound\s*track|score|ost|vol\.?\s*\d+|\d{4})(\b.*)?$/i;

/**
 * Just the "performance variant" words within `NOISE` — remix/remaster/live
 * credits, never the soundtrack/score/ost family. Used to rescue a bracket's
 * leading content instead of deleting the whole thing: "(Super Mario Kart
 * Remix)" has real title content before "Remix"; "(Original Game
 * Soundtrack)" doesn't have anything worth keeping before "Soundtrack".
 */
const TRAILING_DECORATION_WORD =
	/\s*(remaster(ed)?|live|mono|stereo|radio edit|single version|album version|deluxe|edition|bonus|anniversary|demo|instrumental|karaoke|reprise|mix|remix|edit|version|cover)\s*$/i;

/**
 * Guest-credit openers. Anchored at the start of what they introduce — a
 * title is only decorated when it *leads* with "feat.", whereas a title that
 * merely contains "with" ("Sleeping With The Enemy") is the real name.
 */
const FEATURING = /^(feat|ft|featuring|avec|with)\b/i;

/**
 * OST/score decoration that trails a title or album with no bracket or dash
 * at all: "Red Dead Redemption Original Soundtrack", "ELDEN RING ORIGINAL
 * SOUND TRACK", "Halo: Original Soundtrack". Real Spotify albums on the
 * soundtrack playlists do this constantly — strip the cluster wherever it
 * ends the string, whatever punctuation (or none) introduces it. Anchored to
 * the end and requires a real separator character before it, so it can only
 * ever consume a contiguous run right at the tail — never text mid-title.
 */
const TRAILING_SOUNDTRACK =
	/[\s:,/\-–—]+((the|official|original)\s+)*((video\s+)?game\s+|motion\s+picture\s+)?(sound\s*track|score|ost)(\s+(recording|album|collection))?\s*$/i;

/**
 * "Music from Crash Bandicoot N. Sane Trilogy (Original Game Soundtrack)" —
 * some compilation albums lead with this instead of the franchise name.
 * Anchored to the very start; never touches "Music From My Life" as a real title.
 */
const LEADING_MUSIC_FROM = /^music\s+from\s+(the\s+)?/i;

/** Grammatical articles, dropped so "The Beatles" matches "Beatles". */
const LEADING_ARTICLES = /^(les|le|la|l|un|une|des|du|de|the|a|an)\s+(?=\S)/;

/**
 * Filler words dropped when looking for a *partial* match anywhere in a
 * title — never for the exact/similarity check, so "Ori and the Will of the
 * Wisps" still needs the real words to score full points, but a guess that
 * skips "and"/"the" over an otherwise-correct run ("Ori Will of the Wisp")
 * isn't rejected outright for it.
 */
const STOPWORDS = new Set([
	"the",
	"a",
	"an",
	"and",
	"of",
	"le",
	"la",
	"les",
	"l",
	"un",
	"une",
	"des",
	"du",
	"de",
	"et",
]);

/**
 * Sequel numbering Spotify sometimes spells in Roman numerals ("FINAL
 * FANTASY VII", "God of War II") and players almost always type in Arabic
 * ("final fantasy 7", "god of war 2"). Capped at XX — real game/film sequel
 * numbering essentially never goes higher, and stopping there keeps this
 * from swallowing single letters (L, C, D, M) that are common leading
 * articles or otherwise-meaningful words elsewhere.
 */
const ROMAN_NUMERALS: Record<string, string> = {
	i: "1",
	ii: "2",
	iii: "3",
	iv: "4",
	v: "5",
	vi: "6",
	vii: "7",
	viii: "8",
	ix: "9",
	x: "10",
	xi: "11",
	xii: "12",
	xiii: "13",
	xiv: "14",
	xv: "15",
	xvi: "16",
	xvii: "17",
	xviii: "18",
	xix: "19",
	xx: "20",
};

function convertRomanNumerals(text: string): string {
	return text
		.split(" ")
		.map((word) => ROMAN_NUMERALS[word] ?? word)
		.join(" ");
}

/**
 * Strips bracketed groups and trailing dash segments whose contents are pure
 * decoration. Runs while the punctuation is still intact — once brackets are
 * gone there is no way to tell a suffix from part of the title.
 */
function stripNoise(text: string): string {
	let out = text.replace(LEADING_MUSIC_FROM, "");

	// "(feat. Pharrell)", "[Remastered]" — drop the whole group when its
	// contents look like decoration.
	out = out.replace(/[([{]([^)\]}]*)[)\]}]/g, (match, inner: string) => {
		const contents = inner.trim();
		return FEATURING.test(contents) || NOISE.test(contents) ? " " : match;
	});

	// "Song - Remastered 2011", possibly chained: "Song - Live - Remastered".
	let previous: string;
	do {
		previous = out;
		out = out.replace(/\s[-–—]\s[^-–—]*$/, (match) =>
			NOISE.test(match.slice(3).trim()) ? "" : match,
		);
	} while (out !== previous);

	// "Song feat. Pharrell" with no bracket at all.
	out = out.replace(/\s(feat|ft|featuring)\.?\s.*$/i, "");

	// "Red Dead Redemption Original Soundtrack", "Halo: Original Soundtrack" —
	// no bracket, no " - ", just decoration tacked on the end.
	out = out.replace(TRAILING_SOUNDTRACK, "");

	return out;
}

/**
 * Bracket groups `stripNoise` deletes wholesale because they end in a
 * "performance variant" word ("(Super Mario Kart Remix)") sometimes carry
 * real, matchable content before that word — what the track actually
 * samples or references. Rescues that leading content as an extra candidate
 * a player's guess can match against; never removes anything `stripNoise`
 * already does — the primary, bracket-free title still exists alongside it.
 */
function extractBracketCandidates(text: string): string[] {
	const candidates: string[] = [];
	const bracketRegex = /[([{]([^)\]}]*)[)\]}]/g;
	let match: RegExpExecArray | null;
	while ((match = bracketRegex.exec(text))) {
		const contents = match[1].trim();
		if (!contents || FEATURING.test(contents) || !NOISE.test(contents)) continue;

		const withoutDecoration = contents.replace(TRAILING_DECORATION_WORD, "").trim();
		// Only rescue when a real decoration *word* was trimmed off the end and
		// something substantial (2+ words) is left — "Original Game Soundtrack"
		// has nothing to rescue: TRAILING_DECORATION_WORD doesn't match
		// "Soundtrack" at all, so `withoutDecoration` comes back unchanged.
		if (
			withoutDecoration &&
			withoutDecoration !== contents &&
			withoutDecoration.split(/\s+/).length >= 2
		) {
			candidates.push(withoutDecoration);
		}
	}
	return candidates;
}

/** NFD-normalizes accents and quotes; the input side of `stripNoise`. */
function preNormalize(text: string): string {
	return text
		.normalize("NFD")
		// Combining accents left behind by NFD.
		.replace(/[̀-ͯ]/g, "")
		.replace(/[’‘`´]/g, "'")
		.replace(/&/g, " and ");
}

/**
 * Lowercases, collapses punctuation to spaces, converts Roman numerals to
 * Arabic and drops a leading article. The output side of `stripNoise` —
 * split out so `matchTitleTier` can run it over a sub-span of a title, not
 * just the whole thing.
 */
export function finishNormalize(text: string): string {
	const collapsed = text
		.toLowerCase()
		// "assassin's" -> "assassins": a possessive shouldn't tokenize into a
		// stray "s" that misaligns word-by-word matching further down.
		.replace(/'(?=s\b)/g, "")
		// Everything that isn't a letter or digit becomes a separator, so
		// "Sweet Child O' Mine" and "sweet child o mine" converge.
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(LEADING_ARTICLES, "")
		.trim();
	return convertRomanNumerals(collapsed);
}

/**
 * Reduces a title, album or artist name to the core a player could
 * reasonably be expected to type: no accents, case, punctuation, articles or
 * Spotify decoration.
 */
export function normalizeText(text: string): string {
	if (!text) return "";
	return finishNormalize(stripNoise(preNormalize(text)));
}

/**
 * Levenshtein edit distance, two-row dynamic programming. Hand-rolled: the
 * only dependency that could supply one (lodash) has no equivalent.
 */
export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	let current = new Array<number>(b.length + 1);

	for (let i = 1; i <= a.length; i++) {
		current[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			current[j] = Math.min(
				substitution,
				previous[j] + 1, // deletion
				current[j - 1] + 1, // insertion
			);
		}
		[previous, current] = [current, previous];
	}

	return previous[b.length];
}

/** 0 (nothing in common) to 1 (identical), on already-normalized strings. */
export function similarity(a: string, b: string): number {
	const longest = Math.max(a.length, b.length);
	if (longest === 0) return 0;
	return 1 - levenshtein(a, b) / longest;
}

/**
 * Whether a player's answer is close enough to the expected text to count.
 * A blank on either side never matches — an empty answer must not sail
 * through against a track with, say, no album name.
 */
export function isTextMatch(answer: string, target: string): boolean {
	const normalizedAnswer = normalizeText(answer);
	const normalizedTarget = normalizeText(target);

	if (!normalizedAnswer || !normalizedTarget) return false;
	if (normalizedAnswer === normalizedTarget) return true;

	return similarity(normalizedAnswer, normalizedTarget) >= SIMILARITY_THRESHOLD;
}

/**
 * Whether two normalized words are the same word, tolerating the trailing
 * "s" `finishNormalize` leaves behind on a possessive ("assassin's" ->
 * "assassins") — a bare guess ("assassin") shouldn't fail matching against
 * the franchise's own name just because it dropped that "s".
 */
function wordsMatch(a: string, b: string): boolean {
	return a === b || `${a}s` === b || `${b}s` === a;
}

/** A single word is only eligible on its own if it isn't a short filler word. */
function isEligibleRun(words: string[]): boolean {
	if (words.length >= 2) return true;
	return words.length === 1 && words[0].length >= 4;
}

/**
 * Whether `shorter`'s words appear as an ordered, contiguous, in-place run
 * anywhere within `longer` — not just at the very start. Catches a franchise
 * name showing up mid-title ("Spider Man" in "Marvels Spider Man 2", the
 * word "Marvels" leading it) as well as the classic leading case ("Crash
 * Bandicoot" in "Crash Bandicoot N Sane Trilogy").
 *
 * Gated by `isEligibleRun` so a single short filler word can't blanket-match
 * every title that happens to contain it.
 */
function contiguousRun(shorter: string[], longer: string[]): boolean {
	if (!isEligibleRun(shorter)) return false;
	for (let start = 0; start <= longer.length - shorter.length; start++) {
		if (shorter.every((word, i) => wordsMatch(word, longer[start + i]))) return true;
	}
	return false;
}

type ContiguousMatch = { matched: boolean; ratio: number };

/**
 * Finds the best contiguous-run match between two already-normalized word
 * lists, in whichever direction applies: the answer's words inside the
 * target's (the common "opening words only" guess), or the target's words
 * inside the answer's (a guess with extra words wrapped around the correct
 * one). `ratio` is how much of the *target's* content that run covers, for
 * scaling partial credit — always < 1 in practice, since full coverage on
 * the raw (non-filler-stripped) strings would already have matched exactly.
 */
function bestContiguousMatch(answerWords: string[], targetWords: string[]): ContiguousMatch {
	if (
		answerWords.length <= targetWords.length &&
		contiguousRun(answerWords, targetWords)
	) {
		return { matched: true, ratio: answerWords.length / targetWords.length };
	}
	if (
		targetWords.length < answerWords.length &&
		contiguousRun(targetWords, answerWords)
	) {
		return { matched: true, ratio: 1 };
	}
	return { matched: false, ratio: 0 };
}

/**
 * Splits decoration-stripped text on its first subtitle separator: a colon
 * ("Call of Duty: Black Ops – Zombies"), a spaced dash ("Minecraft - Volume
 * Alpha"), or a dash hugging the subtitle with no space after it, closed or
 * not ("TALES OF ARISE -Beyond the Dawn-", "KINGDOM HEARTS -HD 2.5 ReMIX-" —
 * a titling convention several real soundtrack albums in the catalog use).
 * Only the first separator counts, so "Black Ops – Zombies" isn't split any
 * further. Runs on the decoration-stripped text, so a colon that was pure
 * OST decoration ("Halo: Original Soundtrack") is long gone by the time this
 * looks for one — `stripNoise` already consumed it. Returns `null` if none
 * of the three patterns match.
 */
function splitOnSubtitleSeparator(strippedText: string): [string, string] | null {
	const match =
		strippedText.match(/^(.*?)\s*:\s*(.+)$/) ??
		strippedText.match(/^(.*?)\s[-–—]\s(.+)$/) ??
		strippedText.match(/^(.*?)\s[-–—](\S.*?)[-–—]?\s*$/);
	if (!match) return null;
	return [finishNormalize(match[1]), finishNormalize(match[2])];
}

/** How closely an answer matched a title-like target, and how much of it. */
export type TitleMatchResult = {
	tier: "exact" | "partial" | "none";
	/** Fraction of the matched candidate covered — only meaningful for "partial". */
	ratio: number;
};

const NO_MATCH: TitleMatchResult = { tier: "none", ratio: 0 };

/**
 * Every string a player could reasonably be graded against for one target:
 * the decoration-stripped whole, its subtitle-separator segments, and any
 * rescued bracket content ("Super Mario Kart" from "(Super Mario Kart
 * Remix)") both on its own and appended after the primary title (so "Rainbow
 * Road Super Mario Kart" also lines up as one candidate).
 */
function buildCandidates(target: string): string[] {
	const preNormalized = preNormalize(target);
	const strippedTarget = stripNoise(preNormalized);
	const primary = finishNormalize(strippedTarget);

	const candidates = new Set<string>();
	if (primary) candidates.add(primary);

	const segments = splitOnSubtitleSeparator(strippedTarget);
	if (segments) {
		for (const segment of segments) if (segment) candidates.add(segment);
	}

	const rescued = extractBracketCandidates(preNormalized)
		.map((content) => finishNormalize(content))
		.filter(Boolean);
	for (const segment of rescued) {
		candidates.add(segment);
		if (primary) candidates.add(finishNormalize(`${primary} ${segment}`));
	}

	return [...candidates];
}

/**
 * Exact-or-typo-tolerant match against one candidate string, falling back to
 * a contiguous-run partial match — first on the words as typed, then again
 * with filler words (the/and/of/…) dropped from both sides, so skipping a
 * connector ("Ori Will of the Wisp" for "Ori and the Will of the Wisps")
 * doesn't zero out an otherwise-correct run. The filler-tolerant pass can
 * never itself produce "exact" — dropping real words is still worth less
 * than naming them.
 */
function evaluateCandidate(normalizedAnswer: string, candidate: string): TitleMatchResult {
	if (!candidate) return NO_MATCH;
	if (normalizedAnswer === candidate) return { tier: "exact", ratio: 1 };
	if (similarity(normalizedAnswer, candidate) >= SIMILARITY_THRESHOLD) {
		return { tier: "exact", ratio: 1 };
	}

	const answerWords = normalizedAnswer.split(" ");
	const candidateWords = candidate.split(" ");

	const raw = bestContiguousMatch(answerWords, candidateWords);

	const filteredAnswer = answerWords.filter((word) => !STOPWORDS.has(word));
	const filteredCandidate = candidateWords.filter((word) => !STOPWORDS.has(word));
	const filtered =
		filteredAnswer.length && filteredCandidate.length
			? bestContiguousMatch(filteredAnswer, filteredCandidate)
			: { matched: false, ratio: 0 };

	const best = filtered.ratio > raw.ratio ? filtered : raw;
	if (!best.matched) return NO_MATCH;
	return { tier: "partial", ratio: best.ratio };
}

/**
 * Grades an answer against one or more real-world names for the same
 * target — Titre/Musique pass both the track's album and its own name,
 * since Spotify sometimes tells two different stories about what a track
 * "is" (a soundtrack album titled after the game vs. a track named after
 * the specific piece being covered, e.g. "Tom Clancy's Siege" the album next
 * to "Rainbow Six Siege Main Theme" the track). Returns the single best
 * result found across every target and every candidate derived from it.
 */
export function matchTitleTier(answer: string, ...targets: string[]): TitleMatchResult {
	const normalizedAnswer = normalizeText(answer);
	if (!normalizedAnswer) return NO_MATCH;

	let best: TitleMatchResult = NO_MATCH;
	for (const target of targets) {
		if (!target) continue;
		for (const candidate of buildCandidates(target)) {
			const result = evaluateCandidate(normalizedAnswer, candidate);
			if (result.tier === "exact") return result;
			if (result.tier === "partial" && result.ratio > best.ratio) best = result;
		}
	}
	return best;
}
