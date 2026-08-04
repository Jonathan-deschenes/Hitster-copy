import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs-react";
import generateUniqueId from "generate-unique-id";
import type { createGameFormSettingsProps, playerProps } from "../types";
import { createLobby } from "../lib/lobbies";
import { musicStyle } from "../constants/createGameOptions";

export function useCreateGameForm() {
	const navigate = useNavigate();
	const [gameFormSettings, setGameFormSettings] =
		useState<createGameFormSettingsProps>({
			name: "",
			password: "",
			category: musicStyle[0],
			public: true,
			rounds: 10,
		});
	const [player, setPlayer] = useState<playerProps>({
		id: generateUniqueId(),
		pseudo: "",
		host: true,
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
			// hash the password
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = bcrypt.hashSync(gameFormSettings.password, salt);

			const lobby = await createLobby(
				{
					name: gameFormSettings.name,
					passwordHash: hashedPassword,
					category: gameFormSettings.category,
					public: gameFormSettings.public,
					rounds: gameFormSettings.rounds,
				},
				player,
			);

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
		setPlayer,
		isSubmitting,
		error,
		buttonDisabled,
		handleSubmit,
	};
}
