import { supabase } from "../supabaseClient";
import type { lobbyProps, lobbyRowProps } from "../../types";
import { rowToLobby } from "./mappers";
import { findPublicLobbies } from "./queries";

export function subscribeToPublicLobbies(
	onChange: (lobbies: lobbyRowProps[]) => void,
) {
	const refresh = () => {
		findPublicLobbies().then(onChange).catch(console.error);
	};

	const channel = supabase
		.channel("public-lobbies")
		.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "lobbies",
				filter: "is_public=eq.true",
			},
			refresh,
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}

export function subscribeToLobbyByCode(
	code: string,
	onUpdate: (lobby: lobbyProps) => void,
	onDelete?: () => void,
) {
	const channel = supabase
		.channel(`lobby-${code}`)
		.on(
			"postgres_changes",
			{
				event: "UPDATE",
				schema: "public",
				table: "lobbies",
				filter: `code=eq.${code}`,
			},
			(payload) => {
				onUpdate(rowToLobby(payload.new as lobbyRowProps));
			},
		)
		.on(
			"postgres_changes",
			{
				event: "DELETE",
				schema: "public",
				table: "lobbies",
				filter: `code=eq.${code}`,
			},
			() => {
				onDelete?.();
			},
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}
