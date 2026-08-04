import { supabase } from "../supabaseClient";
import type { gameCategoryProps, lobbyProps, lobbyRowProps, playerProps } from "../../types";
import { rowToLobby } from "./mappers";
import { getRandomCode } from "./codeGenerator";

const UNIQUE_VIOLATION = "23505";

type CreateLobbyInput = {
	name: string;
	passwordHash: string;
	category: gameCategoryProps;
	public: boolean;
	rounds: number;
};

export async function createLobby(
	settings: CreateLobbyInput,
	host: playerProps,
): Promise<lobbyProps> {
	// Retry a handful of times in case the random code collides with an
	// existing lobby (the `code` column is unique).
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = getRandomCode();
		const { data, error } = await supabase
			.from("lobbies")
			.insert({
				name: settings.name,
				password_hash: settings.passwordHash,
				is_public: settings.public,
				code,
				category: settings.category,
				game_state: {
					status: "waiting",
					turn: 0,
					round: 0,
					totalRounds: settings.rounds,
				},
				players: [host],
			})
			.select()
			.single();

		if (!error && data) {
			return rowToLobby(data as lobbyRowProps);
		}

		if (error && error.code !== UNIQUE_VIOLATION) {
			throw error;
		}
	}

	throw new Error("Impossible de générer un code de lobby unique, réessaie.");
}

export async function joinLobby(
	row: lobbyRowProps,
	player: playerProps,
): Promise<lobbyProps> {
	const players = [...row.players, player];
	const { data, error } = await supabase
		.from("lobbies")
		.update({ players })
		.eq("id", row.id)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

export async function leaveLobby(
	code: string,
	playerId: string,
): Promise<lobbyProps | null> {
	const { data, error: fetchError } = await supabase
		.from("lobbies")
		.select()
		.eq("code", code)
		.maybeSingle();

	if (fetchError) throw fetchError;
	if (!data) return null;

	const row = data as lobbyRowProps;
	const players = row.players.filter((player) => player.id !== playerId);

	const { data: updated, error } = await supabase
		.from("lobbies")
		.update({ players })
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(updated as lobbyRowProps);
}

export async function deleteLobby(code: string): Promise<void> {
	const { error, count } = await supabase
		.from("lobbies")
		.delete({ count: "exact" })
		.eq("code", code);

	if (error) throw error;

	// RLS silently excludes rows instead of erroring, so a blocked delete
	// looks identical to a successful one unless we check the count.
	if (!count) {
		throw new Error(
			`Aucun lobby avec le code ${code} n'a été supprimé (vérifie la policy RLS "delete" sur la table lobbies).`,
		);
	}
}
