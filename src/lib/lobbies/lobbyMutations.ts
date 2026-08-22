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
import { findLobbyRowByCode } from "./queries";
import {
	regenerateMusicQueue,
	UNIQUE_VIOLATION,
	updateLobbyRow,
} from "./rowOperations";
import { resolveGameQuestion } from "../../util";
import { elapsedMs } from "../playback";

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
): Promise<lobbyProps> {
	// The selected row can be several seconds old. Appending in the browser
	// would let simultaneous joiners overwrite one another with competing
	// snapshots, so PostgreSQL must append against the currently locked row.
	const { data, error } = await supabase
		.rpc("join_lobby", {
			target_lobby_id: row.id,
			joining_player: player,
		})
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

export async function leaveLobby(
	code: string,
	playerId: string,
): Promise<lobbyProps | null> {
	// Keep removal atomic too: a presence cleanup racing a join must not write
	// an older players array back over the newly joined player.
	const { data, error } = await supabase
		.rpc("leave_lobby", {
			lobby_code: code,
			leaving_player_id: playerId,
		})
		.select()
		.maybeSingle();

	if (error) throw error;
	return data ? rowToLobby(data as lobbyRowProps) : null;
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
	playerId: string,
): Promise<lobbyProps | null> {
	const row = await findLobbyRowByCode(code);
	if (!row) return null;

	// Pause a running game so stale audio doesn't keep playing on the outgoing
	// host's browser, and freeze the clock so the handoff gap isn't counted as
	// round time — the new host holds no Spotify context and can only start the
	// track fresh, at whatever position the row says the round has reached.
	const game_state =
		row.game_state.status === GameStatus.Playing
			? {
					...row.game_state,
					status: GameStatus.Paused,
					pausedElapsedMs: elapsedMs(row.game_state),
				}
			: row.game_state;

	return updateLobbyRow(code, {
		players: row.players.map((p) => ({ ...p, host: p.id === playerId })),
		game_state,
	});
}
