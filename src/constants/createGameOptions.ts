import { GameMode, type GameModeEnum, type gameCategoryProps } from "../types";

export const musicStyle: gameCategoryProps[] = [
	{ value: "2EtWHTBuXqWGpG6JmFkM5O", label: "Summer party" },
	{ value: "3tRlJUnhjHmNMTQM5dIV1b", label: "Francophone" },
	{ value: "4PaAYhJOgMIdWKkAKx3KBU", label: "Rock" },
	{ value: "4hS4xpg6lzOrKqA3kAbGdW", label: "Jeux vidéo" },
	{ value: "4OU4FTKX6U5rlPy7qNiaDg", label: "Films et émission" },
	{ value: "09cv5duYGfbvb9kh8Z0iGj", label: "Test" }, // remove in production
];

export const roundsOptions = [
	{ value: "10", label: "10 manches" },
	{ value: "15", label: "15 manches" },
	{ value: "20", label: "20 manches" },
	{ value: "30", label: "30 manches" },
];

export const gameModeOptions: gameCategoryProps[] = [
	{ value: "random", label: "Aléatoire" },
	{ value: "musique", label: "Musique" },
	{ value: "artiste", label: "Artiste" },
	{ value: "annee", label: "Année" },
	{ value: "decennie", label: "Décennie" },
	{ value: "album", label: "Album" },
	{ value: "titre", label: "Titre" },
];

// "aleatoire" is intentionally left out: the round's actual target varies
// each time, so it has no single fixed question to show.
export const gameModeQuestions: Partial<Record<GameModeEnum, string>> = {
	[GameMode.Musique]: "Quel est le titre de cette chanson ?",
	[GameMode.Titre]: "D'oû vient cette musique ?",
	[GameMode.Artiste]: "Quel est l'artiste de cette chanson ?",
	[GameMode.Album]: "Quel est l'album de cette chanson ?",
	[GameMode.Annee]: "En quelle année cette chanson est-elle sortie ?",
	[GameMode.Decennie]: "Dans quelle décennie cette chanson est-elle sortie ?",
};

export const DURATION_MIN = 10;
export const DURATION_MAX = 60;
export const DURATION_STEP = 5;
export const DURATION_DEFAULT = 30;
