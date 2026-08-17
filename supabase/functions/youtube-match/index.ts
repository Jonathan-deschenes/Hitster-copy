import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";

// Persists resolved video ids per Spotify track so an already-seen track skips
// its 100-unit search.list call entirely (see `youtube_match_cache` in
// schema.sql). Service-role client: the cache table has RLS on with no policies,
// so only this key reaches it. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are
// project-wide secrets, already set for spotify-playlist.
const supabaseAdmin = createClient(
	Deno.env.get("SUPABASE_URL")!,
	Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CACHE_TABLE = "youtube_match_cache";

type TrackQuery = {
	id: string;
	name: string;
	artist: string[];
	// Optional caller-supplied candidate ids. The no-quota resolver script
	// (scripts/warm-youtube-cache.mjs) pre-resolves these via YouTube's public
	// search, so this request spends no 100-unit search.list — the function just
	// verifies and caches them. Absent on the normal app path (search runs).
	youtubeIds?: string[];
};

// `videoEmbeddable=true` on the search endpoint is a search-index hint, not a
// guarantee — the search index lags behind a video's actual, current embed
// status. Cast a wider net at search time, then verify each candidate's real
// `status.embeddable` (see `fetchEmbeddableIds`) before keeping it, and only
// keep this many per track for the player's runtime fallback.
const RAW_CANDIDATES_PER_TRACK = 8;
const VERIFIED_CANDIDATES_PER_TRACK = 5;
const VIDEOS_LIST_BATCH_SIZE = 50; // `id` accepts at most 50 comma-separated ids per call

async function searchVideoIds(track: TrackQuery, apiKey: string): Promise<string[]> {
	const url = new URL(SEARCH_ENDPOINT);
	url.searchParams.set("part", "snippet");
	url.searchParams.set("type", "video");
	url.searchParams.set("videoEmbeddable", "true");
	url.searchParams.set("videoSyndicated", "true");
	url.searchParams.set("maxResults", String(RAW_CANDIDATES_PER_TRACK));
	url.searchParams.set("q", `${track.artist.join(" ")} ${track.name}`);
	url.searchParams.set("key", apiKey);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`YouTube search failed (${response.status}): ${await response.text()}`);
	}

	const data = await response.json();
	return (data.items ?? [])
		.map((item) => item?.id?.videoId)
		.filter((videoId: unknown): videoId is string => typeof videoId === "string");
}

/**
 * The authoritative per-video embed/availability check, batched across every
 * candidate from every track in as few `videos.list` calls as possible — this
 * costs 1 quota unit per up-to-50 ids, versus 100 units per search, so it's
 * effectively free next to the search calls that produced the candidates.
 *
 * No per-chunk catch, same reasoning as `searchVideoIds`: a deleted/invalid
 * video id isn't an HTTP error here — the API just omits it from `items` — so
 * a non-ok response only happens for a request-level problem (bad key, quota),
 * which should fail loudly rather than silently mark everything unembeddable.
 */
async function fetchEmbeddableIds(videoIds: string[], apiKey: string): Promise<Set<string>> {
	const embeddable = new Set<string>();

	for (let i = 0; i < videoIds.length; i += VIDEOS_LIST_BATCH_SIZE) {
		const chunk = videoIds.slice(i, i + VIDEOS_LIST_BATCH_SIZE);
		if (chunk.length === 0) continue;

		const url = new URL(VIDEOS_ENDPOINT);
		url.searchParams.set("part", "status");
		url.searchParams.set("id", chunk.join(","));
		url.searchParams.set("key", apiKey);

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`YouTube videos.list failed (${response.status}): ${await response.text()}`);
		}

		const data = await response.json();
		for (const item of data.items ?? []) {
			if (item?.status?.embeddable && item?.status?.privacyStatus === "public") {
				embeddable.add(item.id);
			}
		}
	}

	return embeddable;
}

/**
 * Candidate ids already resolved for these tracks, keyed by Spotify track id.
 * Throws on error rather than degrading to an empty map: a silently bypassed
 * cache means every build re-runs the 100-unit searches this table exists to
 * avoid, invisibly — the same fail-loud reasoning as the API helpers above.
 */
async function readCache(trackIds: string[]): Promise<Map<string, string[]>> {
	if (trackIds.length === 0) return new Map();

	const { data, error } = await supabaseAdmin
		.from(CACHE_TABLE)
		.select("spotify_track_id, youtube_ids")
		.in("spotify_track_id", trackIds);

	if (error) {
		throw new Error(`youtube-match cache read failed: ${error.message}`);
	}

	return new Map(
		(data ?? []).map((row) => [row.spotify_track_id as string, row.youtube_ids as string[]]),
	);
}

/**
 * Refreshes the cache after verification: upserts the live survivor list for
 * every track that still has one (pruning now-dead ids from stale rows and
 * storing freshly-searched ones), and deletes rows whose ids all rotted so the
 * next build re-searches them. Fail-loud, same as `readCache`.
 */
async function writeCache(matches: Record<string, string[]>): Promise<void> {
	const now = new Date().toISOString();
	const rows = Object.entries(matches)
		.filter(([, ids]) => ids.length > 0)
		.map(([spotify_track_id, youtube_ids]) => ({ spotify_track_id, youtube_ids, updated_at: now }));
	const rottedIds = Object.entries(matches)
		.filter(([, ids]) => ids.length === 0)
		.map(([trackId]) => trackId);

	if (rows.length > 0) {
		const { error } = await supabaseAdmin.from(CACHE_TABLE).upsert(rows);
		if (error) throw new Error(`youtube-match cache write failed: ${error.message}`);
	}

	if (rottedIds.length > 0) {
		const { error } = await supabaseAdmin
			.from(CACHE_TABLE)
			.delete()
			.in("spotify_track_id", rottedIds);
		if (error) throw new Error(`youtube-match cache prune failed: ${error.message}`);
	}
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	try {
		const { tracks, cacheOnly } = await req.json();

		if (!Array.isArray(tracks)) {
			return new Response(JSON.stringify({ error: "Missing tracks" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		// A cache hit supplies a track's candidate ids for free; only a miss
		// spends a 100-unit search. The cached ids are still re-verified below
		// (videos.list, ~1 unit/50), so a video that went private/unembeddable
		// since it was cached is pruned rather than served dead.
		const cache = await readCache((tracks as TrackQuery[]).map((track) => track.id));

		// Cache-only (lobby creation): build the queue purely from what's already
		// cached — no search.list, no videos.list verify, no YouTube API key even
		// touched, so creating a game costs zero quota. Uncached tracks return
		// empty and are dropped by regenerateMusicQueue. The cache was
		// embed-verified when it was warmed, and useYoutubePlayer's candidate
		// fallback covers a video that has died since. Warm the cache ahead of
		// time with scripts/warm-youtube-cache.mjs.
		if (cacheOnly) {
			const matches = Object.fromEntries(
				(tracks as TrackQuery[]).map((track) => [
					track.id,
					(cache.get(track.id) ?? []).slice(0, VERIFIED_CANDIDATES_PER_TRACK),
				]),
			);
			return new Response(JSON.stringify({ matches }), {
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const apiKey = Deno.env.get("YOUTUBE_API_KEY");
		if (!apiKey) {
			throw new Error("Missing YOUTUBE_API_KEY secret");
		}

		// No per-track catch here on purpose: `searchVideoIds` only throws on an
		// HTTP-level failure (quota exhausted, bad key, network), never on a
		// genuine zero-result search — swallowing those made a systemic failure
		// (every track silently unmatched) indistinguishable from "this playlist
		// just doesn't exist on YouTube," which produced an empty queue with no
		// error anywhere. Let it fail the whole request loudly instead.
		const rawResults = await Promise.all(
			(tracks as TrackQuery[]).map(async (track) => {
				// Precedence: caller-provided candidates (the no-quota resolver
				// pre-resolved them → zero search quota) > cache > a fresh metered
				// search. An explicit `youtubeIds` (even empty) means "don't
				// search" — the resolver already found whatever exists.
				const provided = Array.isArray(track.youtubeIds) ? track.youtubeIds : null;
				const cached = cache.get(track.id);
				const ids = provided ?? cached ?? (await searchVideoIds(track, apiKey));
				return [track.id, ids.slice(0, RAW_CANDIDATES_PER_TRACK)] as const;
			}),
		);

		const allCandidateIds = [...new Set(rawResults.flatMap(([, ids]) => ids))];
		const embeddableIds = await fetchEmbeddableIds(allCandidateIds, apiKey);

		const matches = Object.fromEntries(
			rawResults.map(([trackId, ids]) => [
				trackId,
				ids.filter((id) => embeddableIds.has(id)).slice(0, VERIFIED_CANDIDATES_PER_TRACK),
			]),
		);

		// Persist the verified survivors: newly-searched tracks enter the cache,
		// stale rows get their dead ids pruned, and fully-rotted rows are removed
		// so the next build re-searches them.
		await writeCache(matches);

		return new Response(JSON.stringify({ matches }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
