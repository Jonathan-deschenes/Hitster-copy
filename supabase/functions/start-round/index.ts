import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
	Deno.env.get("SUPABASE_URL")!,
	Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const questions: Record<string, string> = {
	musique: "Quel est le titre de cette chanson ?",
	titre: "D'oû vient cette musique ?",
	artiste: "Quel est l'artiste de cette chanson ?",
	annee: "En quelle année cette chanson est-elle sortie ?",
	decennie: "Dans quelle décennie cette chanson est-elle sortie ?",
};
const randomModes = ["musique", "artiste", "annee", "decennie"];

function resolveQuestion(mode: string) {
	const questionMode =
		mode === "random"
			? randomModes[Math.floor(Math.random() * randomModes.length)]
			: mode;
	return {
		questionMode,
		question: questions[questionMode] ?? "Quelle est cette chanson ?",
	};
}

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

		const { data: lobby, error: lobbyError } = await supabaseAdmin
			.from("lobbies")
			.select("id, game_state, music_queue")
			.eq("code", lobbyCode)
			.single();
		if (lobbyError || !lobby) throw lobbyError ?? new Error("Lobby not found");

		const status = lobby.game_state?.status;
		if (status === "playing" || status === "paused") {
			return new Response(JSON.stringify({ started: false }), {
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}
		if (status !== "waiting" && status !== "finished") {
			throw new Error("Lobby is not ready to start a round");
		}

		const advancing = status === "finished";
		const round = advancing ? (lobby.game_state.round ?? 0) + 1 : lobby.game_state.round ?? 0;
		const queueLength = lobby.music_queue?.length ?? 0;
		if (round < 0 || round >= queueLength) throw new Error("Private queue position not found");

		const { data: queuedTrack, error: queueError } = await supabaseAdmin
			.from("lobby_music_queue")
			.select("track_id, youtube_ids")
			.eq("lobby_id", lobby.id)
			.eq("position", round)
			.single();
		if (queueError || !queuedTrack) {
			throw queueError ?? new Error("Private queue track not found");
		}

		const resolved = advancing
			? resolveQuestion(lobby.game_state.mode)
			: {
					question: lobby.game_state.question,
					questionMode: lobby.game_state.questionMode,
				};
		const { data: started, error: updateError } = await supabaseAdmin.rpc(
			"start_lobby_round",
			{
				target_lobby_id: lobby.id,
				expected_status: status,
				expected_round: lobby.game_state.round ?? 0,
				next_round: round,
				next_question: resolved.question,
				next_question_mode: resolved.questionMode,
				playback_track: {
					trackId: queuedTrack.track_id,
					youtubeIds: queuedTrack.youtube_ids,
				},
				queue_length: queueLength,
				started_at: Date.now(),
			},
		);
		if (updateError) throw updateError;

		return new Response(JSON.stringify({ started }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
