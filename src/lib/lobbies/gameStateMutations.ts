import { supabase } from "../supabaseClient";
import type { gameStateProps, GameStateEnum, lobbyProps, lobbyRowProps } from "../../types";
import { rowToLobby } from "./mappers";
import { findLobbyRowByCode } from "./queries";

// Reads the current game_state and merges the patch into it rather than
// overwriting the whole column, so a status change doesn't clobber a
// concurrent turn/round update (or vice versa). Since this is a
// read-then-write, two overlapping calls can still race each other.
async function updateGameState(
	code: string,
	patch: Partial<gameStateProps>,
): Promise<lobbyProps> {
	const row = await findLobbyRowByCode(code);
	if (!row) {
		throw new Error(`Aucun lobby trouvé avec le code ${code}.`);
	}

	const { data, error } = await supabase
		.from("lobbies")
		.update({ game_state: { ...row.game_state, ...patch } })
		.eq("code", code)
		.select()
		.single();

	if (error) throw error;
	return rowToLobby(data as lobbyRowProps);
}

export async function updateGameStatus(
	code: string,
	status: GameStateEnum,
): Promise<lobbyProps> {
	return updateGameState(code, { status });
}

export async function updateTurn(
	code: string,
	turn: number,
): Promise<lobbyProps> {
	return updateGameState(code, { turn });
}

export async function updateRound(
	code: string,
	round: number,
): Promise<lobbyProps> {
	return updateGameState(code, { round });
}
