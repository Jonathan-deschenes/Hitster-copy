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
	/** Every round has been played — the final standings are on screen. */
	Ended: "ended",
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
	/**
	 * Epoch ms at which the current round's track should be at position 0.
	 * Shifted forward on resume so paused time doesn't count against the round.
	 *
	 * This is what makes playback survive a host handoff: the promoted host
	 * holds no Spotify context of its own, so it reconstructs where the music
	 * belongs from this timestamp instead of restarting the track. Optional
	 * because lobbies created before it existed don't carry it.
	 */
	roundStartedAt?: number;
	/** Elapsed ms frozen while `status === Paused`; absent while playing. */
	pausedElapsedMs?: number;
	/** Metadata copied from the locked server table only after the round ends. */
	revealedTrack?: musicItemsProps;
};

export type playerProps = {
	id: string;
	pseudo: string;
	host: boolean;
	score: number;
	answer: string;
	/** Client epoch ms when `answer` was submitted, for the speed bonus. */
	answeredAt?: number;
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

// The raw Spotify Web API shapes live in the `spotify-playlist` Edge Function,
// which is the only thing that talks to the catalog API. The client sees only
// the flattened `musicItemsProps` it returns.
type spotifyImageProps = {
	url: string;
	height: number | null;
	width: number | null;
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

/** The only track shape broadcast while a round is in progress. */
export type playbackTrackProps = {
	trackId: string;
	/** Ranked YouTube candidates used by the runtime playback fallback. */
	youtubeIds: string[];
};

export type playlistQueueProps = {
	items: playbackTrackProps[];
	current: number;
	/** Total private queue size; the public `items` array contains at most one track. */
	length: number;
};
