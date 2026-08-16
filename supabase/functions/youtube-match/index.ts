const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";

type TrackQuery = {
	id: string;
	name: string;
	artist: string[];
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

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	try {
		const apiKey = Deno.env.get("YOUTUBE_API_KEY");
		if (!apiKey) {
			throw new Error("Missing YOUTUBE_API_KEY secret");
		}

		const { tracks } = await req.json();

		if (!Array.isArray(tracks)) {
			return new Response(JSON.stringify({ error: "Missing tracks" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		// No per-track catch here on purpose: `searchVideoIds` only throws on an
		// HTTP-level failure (quota exhausted, bad key, network), never on a
		// genuine zero-result search — swallowing those made a systemic failure
		// (every track silently unmatched) indistinguishable from "this playlist
		// just doesn't exist on YouTube," which produced an empty queue with no
		// error anywhere. Let it fail the whole request loudly instead.
		const rawResults = await Promise.all(
			(tracks as TrackQuery[]).map(
				async (track) => [track.id, await searchVideoIds(track, apiKey)] as const,
			),
		);

		const allCandidateIds = [...new Set(rawResults.flatMap(([, ids]) => ids))];
		const embeddableIds = await fetchEmbeddableIds(allCandidateIds, apiKey);

		const matches = Object.fromEntries(
			rawResults.map(([trackId, ids]) => [
				trackId,
				ids.filter((id) => embeddableIds.has(id)).slice(0, VERIFIED_CANDIDATES_PER_TRACK),
			]),
		);

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
