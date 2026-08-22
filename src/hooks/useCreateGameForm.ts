import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs-react";
import type { createGameFormSettingsProps } from "../types";
import { createLobby } from "../lib/lobbies";
import {
	createLobbySessionToken,
	storeLobbySessionToken,
} from "../lib/lobbies/session";
import { gameModeOptions, musicStyle } from "../constants/createGameOptions";
import { usePlayerIdentity } from "./usePlayerIdentity";

export function useCreateGameForm() {
	const navigate = useNavigate();

	const { player, handlePseudoName } = usePlayerIdentity(true);

	const [gameFormSettings, setGameFormSettings] =
		useState<createGameFormSettingsProps>({
			name: "",
			password: "",
			category: musicStyle[0],
			mode: gameModeOptions[0],
			public: true,
			rounds: 10,
			duration: 30,
		});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const buttonDisabled =
		gameFormSettings.name === "" ||
		gameFormSettings.password === "" ||
		gameFormSettings.category === null ||
		isSubmitting;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);

		try {
			const sessionToken = createLobbySessionToken();
			// hash the password
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = bcrypt.hashSync(gameFormSettings.password, salt);

			const lobby = await createLobby(
				{
					name: gameFormSettings.name,
					passwordHash: hashedPassword,
					category: gameFormSettings.category,
					mode: gameFormSettings.mode.value,
					public: gameFormSettings.public,
					rounds: gameFormSettings.rounds,
					duration: gameFormSettings.duration,
				},
				player,
				sessionToken,
			);
			storeLobbySessionToken(lobby.generatedCode, player.id, sessionToken);

			navigate(`/game/${lobby.generatedCode}?current=${player.id}`, {
				state: lobby,
			});
		} catch (err) {
			console.error(err);
			setError("Impossible de créer le lobby, réessaie.");
			setIsSubmitting(false);
		}
	}

	return {
		gameFormSettings,
		setGameFormSettings,
		player,
		handlePseudoName,
		isSubmitting,
		error,
		buttonDisabled,
		handleSubmit,
	};
}
