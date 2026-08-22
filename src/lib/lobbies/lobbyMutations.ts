import { supabase } from "../supabaseClient";
import { GameStatus } from "../../types";
import type {
	gameCategoryProps,
	GameModeEnum,
	lobbyProps,
	lobbyRowProps,
	playerProps,
} from "../../types";
import { rowToLobby } from "./mappers";
import { getRandomCode } from "./codeGenerator";
import {
	regenerateMusicQueue,
	UNIQUE_VIOLATION,
} from "./rowOperations";
import { resolveGameQuestion } from "../../util";

type CreateLobbyInput = {
	name: string;
	passwordHash: string;
	category: gameCategoryProps;
	mode: string;
	public: boolean;
	rounds: number;
	duration: number;
};

export async function createLobby(
	settings: CreateLobbyInput,
	host: playerProps,
	sessionToken: string,
): Promise<lobbyProps> {
	// Retry a handful of times in case the random code collides with an
	// existing lobby (the `code` column is unique).
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = getRandomCode();
		const { question, questionMode } = resolveGameQuestion(settings.mode);
		const { data, error } = await supabase
			.from("lobbies")
			.insert({
				name: settings.name,
				password_hash: settings.passwordHash,
				is_public: settings.public,
				code,
				category: settings.category,
				game_state: {
					mode: settings.mode as GameModeEnum,
					status: GameStatus.Waiting,
					round: 0,
					question,
					questionMode,
					totalRounds: settings.rounds,
					duration: settings.duration,
				},
				players: [host],
			})
			.select()
			.single();

		if (!error && data) {
			const row = data as lobbyRowProps;
			await joinLobby(row, host, sessionToken);
			return regenerateMusicQueue(row.id);
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
	sessionToken: string,
): Promise<lobbyProps> {
	// The selected row can be several seconds old. Appending in the browser
	// would let simultaneous joiners overwrite one another with competing
	// snapshots, so PostgreSQL must append against the currently locked row.
	const { data, error } = await supabase
		.rpc("join_lobby", {
			target_lobby_id: row.id,
			joining_player: player,
			joining_session_token: sessionToken,
		})
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

export async function leaveLobby(
	code: string,
	playerId: string,
	sessionToken: string,
): Promise<lobbyProps | null> {
	// Keep removal atomic too: a session cleanup racing a join must not write
	// an older players array back over the newly joined player.
	const { data, error } = await supabase
		.rpc("leave_lobby", {
			lobby_code: code,
			leaving_player_id: playerId,
			leaving_session_token: sessionToken,
		})
		.select()
		.maybeSingle();

	if (error) throw error;
	return data ? rowToLobby(data as lobbyRowProps) : null;
}

export async function heartbeatLobbySession(
	code: string,
	playerId: string,
	sessionToken: string,
): Promise<boolean> {
	const { data, error } = await supabase.rpc("heartbeat_lobby_session", {
		lobby_code: code,
		session_player_id: playerId,
		provided_session_token: sessionToken,
	});
	if (error) throw error;
	return data === true;
}

export async function kickPlayer(
	code: string,
	hostPlayerId: string,
	hostSessionToken: string,
	targetPlayerId: string,
): Promise<void> {
	const { error } = await supabase.rpc("kick_lobby_player", {
		lobby_code: code,
		host_player_id: hostPlayerId,
		host_session_token: hostSessionToken,
		target_player_id: targetPlayerId,
	});
	if (error) throw error;
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

export async function promotePlayer(
	code: string,
	hostPlayerId: string,
	hostSessionToken: string,
	playerId: string,
): Promise<lobbyProps | null> {
	const { data, error } = await supabase
		.rpc("promote_lobby_player", {
			lobby_code: code,
			host_player_id: hostPlayerId,
			host_session_token: hostSessionToken,
			target_player_id: playerId,
		})
		.select()
		.maybeSingle();

	if (error) throw error;
	return data ? rowToLobby(data as lobbyRowProps) : null;
}
