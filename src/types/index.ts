export type gameCategoryProps = {
	value: string;
	label: string;
};

export type createGameFormSettingsProps = {
	name: string;
	password: string;
	category: gameCategoryProps;
	public: boolean;
	rounds: number;
};

export type joinGameFormSettingsProps = {
	name: string;
	password: string;
};

export type lobbyProps = {
	name: string;
	password: string;
	public: boolean;
	generatedCode: string;
	category: gameCategoryProps;
	game_state: gameStateProps;
	player: playerProps[];
};

export const GameStatus = {
	Waiting: "waiting",
	Playing: "playing",
	Paused: "paused",
	Finished: "finished",
} as const;

export type GameStateEnum = (typeof GameStatus)[keyof typeof GameStatus];

export type gameStateProps = {
	status: GameStateEnum;
	turn: number;
	round: number;
	totalRounds: number;
};

export type playerProps = {
	id: string;
	pseudo: string;
	host?: boolean;
	score?: number;
};

/** Shape of a row in the Supabase `lobbies` table. */
export type lobbyRowProps = {
	id: string;
	name: string;
	password_hash: string;
	is_public: boolean;
	code: string;
	category: gameCategoryProps;
	game_state: gameStateProps;
	players: playerProps[];
	created_at: string;
};
