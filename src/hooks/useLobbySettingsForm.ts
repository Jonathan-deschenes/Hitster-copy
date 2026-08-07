import { useState, type FormEvent, type SetStateAction } from "react";
import type { lobbyProps, lobbySettingsFormProps } from "../types";
import { gameModeOptions } from "../constants/createGameOptions";
import { updateGameSettings } from "../lib/lobbies/gameStateMutations";

export function useLobbySettingsForm(
	lobby: lobbyProps,
	mobileMenuClose: React.Dispatch<SetStateAction<boolean>>,
	desktopMenuClose: React.Dispatch<SetStateAction<boolean>>,
) {
	const [settings, setSettings] = useState<lobbySettingsFormProps>({
		mode: lobby.game_state?.mode ?? gameModeOptions[0],
		rounds: lobby.game_state?.totalRounds ?? 10,
		category: lobby.category,
		public: lobby.public,
		duration: lobby.game_state?.duration,
	});

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		mobileMenuClose(false);
		desktopMenuClose(false);
		await updateGameSettings(lobby.generatedCode, settings);
	}

	return { settings, setSettings, handleSubmit };
}
