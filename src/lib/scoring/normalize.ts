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
 * Decoration Spotify appends to track and album names. Matched against the
 * contents of a bracketed group or of a trailing " - " segment — never
 * against the middle of a title, so "Live and Let Die" survives while
 * "Live at Wembley" as a suffix does not.
 */
const NOISE =
	/^(.*\b)?(remaster|remastered|live|mono|stereo|radio edit|single version|album version|deluxe|edition|bonus|anniversary|demo|instrumental|karaoke|reprise|mix|remix|edit|version|from|original motion picture|original soundtrack|soundtrack|ost|vol\.?\s*\d+|\d{4})(\b.*)?$/i;

/**
 * Guest-credit openers. Anchored at the start of what they introduce — a
 * title is only decorated when it *leads* with "feat.", whereas a title that
 * merely contains "with" ("Sleeping With The Enemy") is the real name.
 */
const FEATURING = /^(feat|ft|featuring|avec|with)\b/i;

/** Grammatical articles, dropped so "The Beatles" matches "Beatles". */
const LEADING_ARTICLES = /^(les|le|la|l|un|une|des|du|de|the|a|an)\s+(?=\S)/;

/**
 * Strips bracketed groups and trailing dash segments whose contents are pure
 * decoration. Runs while the punctuation is still intact — once brackets are
 * gone there is no way to tell a suffix from part of the title.
 */
function stripNoise(text: string): string {
	let out = text;

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

	return out;
}

/**
 * Reduces a title, album or artist name to the core a player could
 * reasonably be expected to type: no accents, case, punctuation, articles or
 * Spotify decoration.
 */
export function normalizeText(text: string): string {
	if (!text) return "";

	return (
		stripNoise(
			text
				.normalize("NFD")
				// Combining accents left behind by NFD.
				.replace(/[̀-ͯ]/g, "")
				.replace(/[’‘`´]/g, "'")
				.replace(/&/g, " and "),
		)
			.toLowerCase()
			// Everything that isn't a letter or digit becomes a separator, so
			// "Sweet Child O' Mine" and "sweet child o mine" converge.
			.replace(/[^a-z0-9]+/g, " ")
			.trim()
			.replace(LEADING_ARTICLES, "")
			.trim()
	);
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
