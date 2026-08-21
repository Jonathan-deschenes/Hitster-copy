import { createClient } from "npm:@supabase/supabase-js@2";
import { scoreRound } from "../../../src/lib/scoring/scoreRound.ts";
import type {
	gameStateProps,
	musicItemsProps,
	playerProps,
} from "../../../src/types/index.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
	Deno.env.get("SUPABASE_URL")!,
	Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type LobbyForScoring = {
	id: string;
	game_state: gameStateProps;
	players: playerProps[];
};

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

	try {
		const { lobbyCode } = await req.json();
		if (typeof lobbyCode !== "string") {
			return new Response(JSON.stringify({ error: "Invalid lobby code" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const { data, error: lobbyError } = await supabaseAdmin
			.from("lobbies")
			.select("id, game_state, players")
			.eq("code", lobbyCode)
			.single();
		if (lobbyError || !data) throw lobbyError ?? new Error("Lobby not found");

		const lobby = data as LobbyForScoring;
		if (lobby.game_state.status === "finished") {
			return new Response(JSON.stringify({ finalized: false }), {
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const { data: queuedTrack, error: queueError } = await supabaseAdmin
			.from("lobby_music_queue")
			.select("track_id")
			.eq("lobby_id", lobby.id)
			.eq("position", lobby.game_state.round)
			.single();
		if (queueError || !queuedTrack) {
			throw queueError ?? new Error("Private queue track not found");
		}

		const { data: metadataRow, error: metadataError } = await supabaseAdmin
			.from("track_metadata")
			.select("metadata")
			.eq("lobby_id", lobby.id)
			.eq("track_id", queuedTrack.track_id)
			.single();
		if (metadataError || !metadataRow) {
			throw metadataError ?? new Error("Track metadata not found");
		}
		const track = metadataRow.metadata as musicItemsProps;
		const results = scoreRound(
			lobby.players,
			track,
			lobby.game_state.questionMode ?? lobby.game_state.mode,
			lobby.game_state,
		);
		const scoredPlayers = lobby.players.map((player) => {
			const result = results[player.id] ?? { points: 0, correct: false };
			return {
				...player,
				score: (player.score ?? 0) + result.points,
				roundPoints: result.points,
				roundCorrect: result.correct,
			};
		});

		const { data: finalized, error: finalizeError } = await supabaseAdmin.rpc(
			"finalize_lobby_round",
			{
				lobby_code: lobbyCode,
				expected_round: lobby.game_state.round,
				scored_players: scoredPlayers,
				revealed_track: track,
			},
		);
		if (finalizeError) throw finalizeError;

		return new Response(JSON.stringify({ finalized }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
