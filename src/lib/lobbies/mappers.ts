import type { lobbyProps, lobbyRowProps } from "../../types";

export function rowToLobby(row: lobbyRowProps): lobbyProps {
	return {
		name: row.name,
		password: row.password_hash,
		public: row.is_public,
		generatedCode: row.code,
		category: row.category,
		game_state: row.game_state,
		player: row.players,
		music_queue: row.music_queue,
	};
}
