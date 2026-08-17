import { supabase } from "../supabaseClient";

type TrackQuery = {
	id: string;
	name: string;
	artist: string[];
};

type YoutubeMatchResponse = {
	matches: Record<string, string[]>;
};

/**
 * The Edge Function fails loudly (HTTP 500) on a systemic problem — daily quota
 * exhausted, bad key, network — so the real reason is in the response body, not
 * the generic `FunctionsHttpError`. Pull it out so the toast can name the cause
 * instead of hiding it behind "impossible de trouver les vidéos."
 */
async function readFunctionError(error: unknown): Promise<string | null> {
	const context = (error as { context?: unknown } | null)?.context;
	if (!(context instanceof Response)) return null;
	try {
		const body = await context.clone().json();
		return typeof body?.error === "string" ? body.error : null;
	} catch {
		return null;
	}
}

/**
 * Candidate video ids per track, ranked by search relevance — never just one, see `youtube-match`.
 *
 * `cacheOnly` serves the queue purely from the pre-warmed cache and never spends
 * a metered search — lobby creation uses it so building a game costs no quota.
 * Uncached tracks come back empty and are dropped by the caller.
 */
export async function matchYoutubeVideos(
	tracks: TrackQuery[],
	options?: { cacheOnly?: boolean },
): Promise<Record<string, string[]>> {
	const { data, error } = await supabase.functions.invoke<YoutubeMatchResponse>(
		"youtube-match",
		{ body: { tracks, cacheOnly: options?.cacheOnly ?? false } },
	);

	if (error || !data) {
		const detail = await readFunctionError(error);

		// The common, expected failure — the YouTube Data API allows only a
		// handful of full queue builds per day. Name it so it's actionable
		// (wait for the daily reset, or raise the project's quota) rather than
		// looking like a generic matching miss.
		if (detail && /quota|rate ?limit|RESOURCE_EXHAUSTED|429|403/i.test(detail)) {
			throw new Error(
				"Quota YouTube quotidien atteint. Réessaie demain, ou augmente le quota du projet Google Cloud.",
			);
		}

		throw new Error("Impossible de trouver les vidéos YouTube correspondantes.");
	}

	return data.matches;
}
