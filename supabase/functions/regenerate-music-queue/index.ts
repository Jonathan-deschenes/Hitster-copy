import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const QUEUE_BUFFER_RATIO = 1.3;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type Metadata = {
	id: string;
	name: string;
	artist: string[];
	album: string;
	duration: number;
	cover: { url: string; width: number | null; height: number | null } | null;
	releaseDate: string;
};

function shuffle<T>(items: T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

async function fetchTracks(playlistId: string, rounds: number): Promise<Metadata[]> {
	const response = await fetch(`${supabaseUrl}/functions/v1/spotify-playlist`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			apikey: serviceRoleKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			playlistId,
			maxTracks: Math.ceil(rounds * QUEUE_BUFFER_RATIO),
		}),
	});
	if (!response.ok) throw new Error(`Spotify queue fetch failed: ${await response.text()}`);
	const data = await response.json();
	return data.musics ?? [];
}

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

	try {
		const { lobbyId } = await req.json();
		if (typeof lobbyId !== "string") {
			return new Response(JSON.stringify({ error: "Invalid queue payload" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}
		const { data: lobby, error: lobbyReadError } = await supabaseAdmin
			.from("lobbies")
			.select("category, game_state")
			.eq("id", lobbyId)
			.single();
		if (lobbyReadError || !lobby) throw lobbyReadError ?? new Error("Lobby not found");
		const playlistId = lobby.category?.value;
		const rounds = lobby.game_state?.totalRounds;
		if (
			typeof playlistId !== "string" ||
			!Number.isInteger(rounds) ||
			rounds < 1 ||
			rounds > 100
		) {
			throw new Error("Lobby has invalid queue settings");
		}

		const tracks = await fetchTracks(playlistId, rounds);
		const { data: cached, error: cacheError } = await supabaseAdmin
			.from("youtube_match_cache")
			.select("spotify_track_id, youtube_ids")
			.in("spotify_track_id", tracks.map((track) => track.id));
		if (cacheError) throw cacheError;

		const youtubeByTrack = new Map(
			(cached ?? []).map((row) => [row.spotify_track_id as string, row.youtube_ids as string[]]),
		);
		const selected = shuffle(
			tracks.filter((track) => (youtubeByTrack.get(track.id)?.length ?? 0) > 0),
		).slice(0, rounds);
		if (selected.length === 0) {
			throw new Error("Aucune musique en cache pour cette playlist.");
		}

		const { error: metadataError } = await supabaseAdmin.from("track_metadata").upsert(
			selected.map((track) => ({ lobby_id: lobbyId, track_id: track.id, metadata: track })),
			{ onConflict: "lobby_id,track_id" },
		);
		if (metadataError) throw metadataError;

		const musicQueue = {
			items: selected.map((track) => ({
				trackId: track.id,
				youtubeIds: youtubeByTrack.get(track.id) ?? [],
			})),
			current: 0,
		};
		const { error: lobbyError } = await supabaseAdmin
			.from("lobbies")
			.update({ music_queue: musicQueue })
			.eq("id", lobbyId);
		if (lobbyError) throw lobbyError;

		return new Response(JSON.stringify({ queued: selected.length }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
