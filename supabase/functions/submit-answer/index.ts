import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
	Deno.env.get("SUPABASE_URL")!,
	Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
	if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

	try {
		const { lobbyCode, playerId, answer } = await req.json();
		if (
			typeof lobbyCode !== "string" ||
			typeof playerId !== "string" ||
			typeof answer !== "string" ||
			!answer.trim() ||
			answer.length > 300
		) {
			return new Response(JSON.stringify({ error: "Invalid answer payload" }), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const { error } = await supabaseAdmin.rpc("submit_lobby_answer", {
			lobby_code: lobbyCode,
			submitted_player_id: playerId,
			submitted_answer: answer.trim(),
			submitted_at: Date.now(),
		});
		if (error) throw error;

		return new Response(JSON.stringify({ accepted: true }), {
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	}
});
