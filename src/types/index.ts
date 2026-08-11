export type gameCategoryProps = {
	value: string;
	label: string;
};

export type createGameFormSettingsProps = {
	name: string;
	password: string;
	category: gameCategoryProps;
	mode: gameCategoryProps;
	public: boolean;
	rounds: number;
	duration: number;
};

export type joinGameFormSettingsProps = {
	name: string;
	password: string;
};

export type lobbySettingsFormProps = {
	mode: string;
	rounds: number;
	category: gameCategoryProps;
	public: boolean;
	duration: number;
};

export type lobbyProps = {
	name: string;
	password: string;
	public: boolean;
	generatedCode: string;
	category: gameCategoryProps;
	game_state: gameStateProps;
	player: playerProps[];
	music_queue: playlistQueueProps;
};

export const GameStatus = {
	Waiting: "waiting",
	Playing: "playing",
	Paused: "paused",
	Finished: "finished",
} as const;

export const GameMode = {
	Aleatoire: "random",
	Musique: "musique",
	Artiste: "artiste",
	Annee: "annee",
	Decennie: "decennie",
	Album: "album",
	Titre: "titre",
} as const;

export type GameStateEnum = (typeof GameStatus)[keyof typeof GameStatus];

export type GameModeEnum = (typeof GameMode)[keyof typeof GameMode];

export type gameStateProps = {
	mode: GameModeEnum;
	status: GameStateEnum;
	turn: number;
	round: number;
	question: string;
	/**
	 * The mode the current round actually asks about. Identical to `mode`
	 * except in `Aleatoire`, where it holds the mode drawn for this round —
	 * without it the answer couldn't be scored, since only the question text
	 * is persisted.
	 */
	questionMode: GameModeEnum;
	totalRounds: number;
	duration: number;
};

export type playerProps = {
	id: string;
	pseudo: string;
	host: boolean;
	score: number;
	answer: string;
	/** Points won in the round that just finished. Optional: lobbies created
	 * before scoring existed have players without it. */
	roundPoints?: number;
	/** Whether that answer was judged correct, to tell "+0 for a wrong guess"
	 * apart from "0 because this mode awards nothing". */
	roundCorrect?: boolean;
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
	music_queue: playlistQueueProps;
};

export type spotifyImageProps = {
	url: string;
	height: number | null;
	width: number | null;
};

export type spotifyArtistProps = {
	id: string;
	name: string;
};

export type spotifyAlbumProps = {
	id: string;
	name: string;
	release_date: string;
	images: spotifyImageProps[];
};

export type spotifyTrackProps = {
	id: string;
	name: string;
	duration_ms: number;
	artists: spotifyArtistProps[];
	album: spotifyAlbumProps;
};

// via GET /v1/playlists/{playlist_id}/items
export type spotifyPlaylistItemProps = {
	added_at: string;
	is_local: boolean;
	track: spotifyTrackProps;
};

export type spotifyPlaylistItemsPageProps = {
	items: spotifyPlaylistItemProps[];
	total: number;
	limit: number;
	offset: number;
	next: string | null;
};

export type musicItemsProps = {
	id: string;
	name: string;
	artist: string[];
	album: string;
	duration: number;
	cover: spotifyImageProps;
	releaseDate: string;
};

export type playlistQueueProps = {
	items: musicItemsProps[];
	current: number;
};
