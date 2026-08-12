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
 * "Live at Wembley" as a suffix does not. `sound\s*track` also catches
 * "SOUND TRACK" written as two words, which several game OST albums do.
 */
const NOISE =
	/^(.*\b)?(remaster|remastered|live|mono|stereo|radio edit|single version|album version|deluxe|edition|bonus|anniversary|demo|instrumental|karaoke|reprise|mix|remix|edit|version|from|original motion picture|original soundtrack|sound\s*track|score|ost|vol\.?\s*\d+|\d{4})(\b.*)?$/i;

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
 * Lowercases, collapses punctuation to spaces and drops a leading article.
 * The output side of `stripNoise` — split out so `isTitleMatch` can run it
 * over a sub-span of a title, not just the whole thing.
 */
function finishNormalize(text: string): string {
	return text
		.toLowerCase()
		// Everything that isn't a letter or digit becomes a separator, so
		// "Sweet Child O' Mine" and "sweet child o mine" converge.
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(LEADING_ARTICLES, "")
		.trim();
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
 * Whole-word prefix containment: true when the shorter side's words are a
 * leading, in-order run of the longer side's words. Catches a franchise name
 * with no punctuation marking where it ends — "Crash Bandicoot" vs. "Crash
 * Bandicoot N. Sane Trilogy", "God of War" vs. "God of War II".
 *
 * Gated on the shorter side having at least two words, so a single common
 * word ("Dead", "The", "Call") can't blanket-match every title that starts
 * with it. `isTitleMatch` only reaches for this when there's no explicit
 * subtitle separator to split on instead — see there for why a split
 * segment doesn't need this gate.
 */
function isPrefixMatch(normalizedAnswer: string, normalizedTarget: string): boolean {
	const answerWords = normalizedAnswer.split(" ");
	const targetWords = normalizedTarget.split(" ");
	const [shorter, longer] =
		answerWords.length <= targetWords.length
			? [answerWords, targetWords]
			: [targetWords, answerWords];

	if (shorter.length < 2) return false;

	return shorter.every((word, i) => word === longer[i]);
}

/**
 * Splits decoration-stripped text on its first subtitle separator — a colon
 * ("Call of Duty: Black Ops – Zombies") or a spaced dash ("Minecraft -
 * Volume Alpha") — into the two halves either side of it, or `null` if there
 * isn't one. Only the first separator counts, so "Black Ops – Zombies"
 * isn't split any further. Runs on the decoration-stripped text, so a colon
 * that was pure OST decoration ("Halo: Original Soundtrack") is long gone
 * by the time this looks for one — `stripNoise` already consumed it.
 */
function splitOnSubtitleSeparator(strippedText: string): [string, string] | null {
	const match =
		strippedText.match(/^(.*?)\s*:\s*(.+)$/) ??
		strippedText.match(/^(.*?)\s[-–—]\s(.+)$/);
	if (!match) return null;
	return [finishNormalize(match[1]), finishNormalize(match[2])];
}

/** Exact, typo-tolerant, or whole-word-prefix match against one candidate. */
function matchesCandidate(normalizedAnswer: string, candidate: string): boolean {
	if (!candidate) return false;
	if (normalizedAnswer === candidate) return true;
	if (similarity(normalizedAnswer, candidate) >= SIMILARITY_THRESHOLD) return true;
	return isPrefixMatch(normalizedAnswer, candidate);
}

/**
 * Accepts whichever half of a subtitle-separated album name a player
 * actually recognizes: the franchise it leads with ("Halo" for "Halo:
 * Combat Evolved"), or the specific title it names after the separator
 * ("Skyrim" for "The Elder Scrolls V: Skyrim"). A bare exact/similarity
 * check against each half needs no length gate — the separator is Spotify's
 * own explicit boundary, not an inference we're making from word position,
 * so a single-word half is exactly as trustworthy as a multi-word one. When
 * there's no separator at all, falls back to `isPrefixMatch` against the
 * whole title, for franchise names Spotify just appends a subtitle onto
 * with no punctuation ("Crash Bandicoot" for "Crash Bandicoot N. Sane
 * Trilogy").
 */
export function isTitleMatch(answer: string, target: string): boolean {
	const normalizedAnswer = normalizeText(answer);
	if (!normalizedAnswer) return false;

	const strippedTarget = stripNoise(preNormalize(target));
	const normalizedTarget = finishNormalize(strippedTarget);
	if (!normalizedTarget) return false;

	if (matchesCandidate(normalizedAnswer, normalizedTarget)) return true;

	const segments = splitOnSubtitleSeparator(strippedTarget);
	if (!segments) return false;

	return segments.some((segment) => matchesCandidate(normalizedAnswer, segment));
}
