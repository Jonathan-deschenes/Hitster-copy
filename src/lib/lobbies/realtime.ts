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

	// No `is_public` filter here: Realtime's postgres_changes filter is
	// evaluated against the NEW row on UPDATE, so a public->private toggle
	// (new row has is_public=false) would never match `is_public=eq.true`
	// and the change would never reach this callback. Instead we listen to
	// every change on the table and let `findPublicLobbies()` (called by
	// `refresh`) do the actual is_public filtering server-side.
	const channel = supabase
		.channel("public-lobbies")
		.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "lobbies",
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

/**
 * Tracks the current player's presence on a per-lobby channel and reports
 * when another tracked player's socket disconnects (tab closed, crash,
 * network loss, ...). Detection happens server-side from the websocket
 * connection itself, so unlike `beforeunload` it doesn't depend on the
 * departing client running any JS on the way out.
 */
export function subscribeToLobbyPresence(
	code: string,
	playerId: string,
	onPlayerLeave: (playerId: string) => void,
): () => void {
	const channel = supabase.channel(`presence-lobby-${code}`, {
		config: { presence: { key: playerId } },
	});

	channel
		.on("presence", { event: "leave" }, ({ key }) => {
			onPlayerLeave(key);
		})
		.subscribe((status) => {
			if (status === "SUBSCRIBED") {
				channel.track({ online_at: new Date().toISOString() });
			}
		});

	return () => {
		supabase.removeChannel(channel);
	};
}
