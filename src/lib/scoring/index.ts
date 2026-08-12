// Only what the app outside `lib/scoring` uses. The normalizer, the
// Levenshtein helpers and the points tables are internals of `scoreRound` —
// import them from their modules if you're working inside this folder.
export { parseReleaseYear } from "./parse";
export { expectedAnswer, scoreRound } from "./scoreRound";
