export type gameCategoryProps = {
	value: string;
	label: string;
};

export type createGameFormSettingsProps = {
	name: string;
	password: string;
	category: gameCategoryProps;
	public: boolean;
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
	player: playerProps[];
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
	players: playerProps[];
	created_at: string;
};
