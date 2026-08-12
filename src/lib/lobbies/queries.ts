import { supabase } from "../supabaseClient";
import type { lobbyProps, lobbyRowProps } from "../../types";
import { rowToLobby } from "./mappers";

export async function findLobbyRowByCode(
	code: string,
): Promise<lobbyRowProps | null> {
	const { data, error } = await supabase
		.from("lobbies")
		.select()
		.eq("code", code)
		.maybeSingle();

	if (error) throw error;
	return data as lobbyRowProps | null;
}

export async function findPublicLobbies(): Promise<lobbyRowProps[]> {
	const { data, error } = await supabase
		.from("lobbies")
		.select()
		.eq("is_public", true)
		.order("created_at", { ascending: false });

	if (error) throw error;
	return (data ?? []) as lobbyRowProps[];
}

export async function getLobbyByCode(code: string): Promise<lobbyProps | null> {
	const { data, error } = await supabase
		.from("lobbies")
		.select()
		.eq("code", code)
		.maybeSingle();

	if (error) throw error;
	return data ? rowToLobby(data as lobbyRowProps) : null;
}
