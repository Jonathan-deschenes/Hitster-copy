/**
 * Turning free text into the numbers the year and decade modes compare.
 *
 * Both sides are messy: Spotify's `releaseDate` comes at year, month or day
 * precision depending on the album, and players type "80s", "années 90" or
 * "1984" for the same idea.
 */

const EARLIEST_YEAR = 1000;
const LATEST_YEAR = 2999;

/**
 * The release year of a track, or `null` when Spotify gave us nothing usable.
 *
 * Deliberately a string slice rather than `new Date(releaseDate).getFullYear()`:
 * a date-only string is parsed as UTC midnight, which `getFullYear()` then
 * renders in local time — so "1984-01-01" reads back as 1983 anywhere west of
 * Greenwich.
 */
export function parseReleaseYear(releaseDate: string | undefined): number | null {
	if (!releaseDate) return null;

	const year = Number(releaseDate.slice(0, 4));
	if (!Number.isInteger(year) || year < EARLIEST_YEAR || year > LATEST_YEAR) {
		return null;
	}
	return year;
}

/**
 * The year a player meant, or `null` if their answer holds no year at all.
 * A year has to be written in full — a bare "84" is a decade shorthand, not a
 * year, and guessing which one they meant would silently score the wrong thing.
 */
export function parseAnswerYear(answer: string | undefined): number | null {
	if (!answer) return null;

	const match = answer.match(/\d{4}/);
	if (!match) return null;

	const year = Number(match[0]);
	return year >= EARLIEST_YEAR && year <= LATEST_YEAR ? year : null;
}

/** The decade a year belongs to, as its first year: 1987 -> 1980. */
export function decadeOf(year: number): number {
	return Math.floor(year / 10) * 10;
}

/**
 * The decade a player meant, as its first year. Accepts "1980", "1980s",
 * "80", "80s", "années 80" and "'90".
 *
 * A two-digit shorthand is ambiguous forever, so it's split where recorded
 * music makes it least wrong: 30-99 reads as last century, 00-29 as this one.
 * That covers 1930-2029, which comfortably contains any playlist in the game.
 */
export function parseAnswerDecade(answer: string | undefined): number | null {
	if (!answer) return null;

	const fullYear = parseAnswerYear(answer);
	if (fullYear !== null) return decadeOf(fullYear);

	const shorthand = answer.match(/\d{1,2}/);
	if (!shorthand) return null;

	const value = Number(shorthand[0]);
	return decadeOf(value >= 30 ? 1900 + value : 2000 + value);
}
