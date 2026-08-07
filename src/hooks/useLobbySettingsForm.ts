import { useState, type FormEvent } from "react";
import type { lobbyProps, lobbySettingsFormProps } from "../types";
import { gameModeOptions } from "../constants/createGameOptions";

export function useLobbySettingsForm(
	lobby: lobbyProps,
	onRestart: (settings: lobbySettingsFormProps) => void,
) {
	const [settings, setSettings] = useState<lobbySettingsFormProps>({
		mode: lobby.game_state?.mode ?? gameModeOptions[0],
		rounds: lobby.game_state?.totalRounds ?? 10,
		category: lobby.category,
		public: lobby.public,
		duration: lobby.game_state?.duration,
	});

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onRestart(settings);
	}

	return { settings, setSettings, handleSubmit };
}
