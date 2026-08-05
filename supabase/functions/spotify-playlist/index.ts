import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const FIELDS =
	"items(item(id,name,duration_ms,artists(name),album(release_date,images))),total,limit,offset";
const PAGE_LIMIT = 50;

const supabaseAdmin = createClient(
	Deno.env.get("SUPABASE_URL")!,
	Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getCatalogAccessToken(): Promise<string> {
	const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
	if (!clientId) {
		throw new Error("Missing SPOTIFY_CLIENT_ID secret");
	}

	const { data: row, error: readError } = await supabaseAdmin
		.from("spotify_catalog_token")
		.select("refresh_token")
		.eq("id", 1)
		.single();

	if (readError || !row) {
		throw new Error(
			"No Spotify catalog refresh token stored yet — see supabase/schema.sql.",
		);
	}

	const response = await fetch(TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: row.refresh_token,
			client_id: clientId,
		}),
	});

	if (!response.ok) {
		throw new Error(`Spotify token refresh failed: ${await response.text()}`);
	}

	const data = await response.json();

	// Spotify's PKCE refresh tokens are single-use: it just invalidated the
	// one we sent and (usually) handed back a new one. Persist it immediately
	// so the next invocation doesn't get invalid_grant.
	if (data.refresh_token) {
		await supabaseAdmin
			.from("spotify_catalog_token")
			.update({ refresh_token: data.refresh_token, updated_at: new Date().toISOString() })
			.eq("id", 1);
	}

	return data.access_token as string;
}

// deno-lint-ignore no-explicit-any
function toMusicItem(playlistItem: any) {
	const track = playlistItem?.item;

	// Local files, region-unavailable, or removed tracks show up with no
	// usable track object (or no album/artists) — skip them instead of crashing.
	if (!track?.id || !track?.album) return null;

	return {
		id: track.id,
		name: track.name,
		artist: (track.artists ?? []).map((artist: { name: string }) => artist.name),
		duration: track.duration_ms,
		cover: track.album.images?.[0] ?? track.album.images?.at(-1) ?? null,
		releaseDate: track.album.release_date ?? "",
	};
}

async function fetchPage(playlistId: string, token: string, offset: number) {
	const url = new URL(`https://api.spotify.com/v1/playlists/${playlistId}/items`);
	url.searchParams.set("fields", FIELDS);
	url.searchParams.set("limit", String(PAGE_LIMIT));
	url.searchParams.set("offset", String(offset));

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok) {
		throw new Error(`Spotify playlist fetch failed (${response.status}): ${await response.text()}`);
	}

	return response.json();
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	try {
		const { playlistId, maxTracks } = await req.json();

		if (!playlistId || typeof playlistId !== "string") {
			return new Response(JSON.stringify({ error: "Missing playlistId" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const token = await getCatalogAccessToken();

		const firstPage = await fetchPage(playlistId, token, 0);

		const wantedTracks =
			typeof maxTracks === "number" ? Math.min(maxTracks, firstPage.total) : firstPage.total;
		const pagesNeeded = Math.ceil(wantedTracks / PAGE_LIMIT);

		const remainingPages = await Promise.all(
			Array.from({ length: pagesNeeded - 1 }, (_, i) =>
				fetchPage(playlistId, token, (i + 1) * PAGE_LIMIT),
			),
		);

		// deno-lint-ignore no-explicit-any
		const musics = [firstPage, ...remainingPages]
			.flatMap((page: any) => page.items.map(toMusicItem))
			.filter((music) => music !== null)
			.slice(0, wantedTracks);

		return new Response(JSON.stringify({ musics }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: (err as Error).message }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
