import { supabase } from "./supabaseClient";
import type {
	gameCategoryProps,
	lobbyProps,
	lobbyRowProps,
	playerProps,
} from "../types";

const CODE_LENGTH = 4;
const CODE_CHARS = "0123456789";
const UNIQUE_VIOLATION = "23505";

function getRandomCode(length = CODE_LENGTH, chars = CODE_CHARS) {
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function rowToLobby(row: lobbyRowProps): lobbyProps {
	return {
		name: row.name,
		password: row.password_hash,
		public: row.is_public,
		generatedCode: row.code,
		category: row.category,
		player: row.players,
	};
}

type CreateLobbyInput = {
	name: string;
	passwordHash: string;
	category: gameCategoryProps;
	public: boolean;
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

export async function findLobbyRowByName(
	name: string,
): Promise<lobbyRowProps | null> {
	const { data, error } = await supabase
		.from("lobbies")
		.select()
		.eq("name", name)
		.maybeSingle();

	if (error) throw error;
	return data as lobbyRowProps | null;
}

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

export async function getLobbyByCode(code: string): Promise<lobbyProps | null> {
	const { data, error } = await supabase
		.from("lobbies")
		.select()
		.eq("code", code)
		.maybeSingle();

	if (error) throw error;
	return data ? rowToLobby(data as lobbyRowProps) : null;
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
			`Aucun lobby avec le code ${code} n'a été supprimé (vérifie la policy RLS "delete" sur la table lobbies).`
		);
	}
}
