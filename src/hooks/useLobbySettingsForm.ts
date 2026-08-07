import { useState, type FormEvent } from "react";
import type { lobbyProps, lobbySettingsFormProps } from "../types";
import { gameModeOptions, DURATION_DEFAULT } from "../constants/createGameOptions";

export function useLobbySettingsForm(
	lobby: lobbyProps,
	onRestart: (settings: lobbySettingsFormProps) => void,
) {
	const [settings, setSettings] = useState<lobbySettingsFormProps>({
		mode: gameModeOptions[0].value,
		rounds: lobby.game_state?.totalRounds ?? 10,
		category: lobby.category,
		public: lobby.public,
		duration: DURATION_DEFAULT,
	});

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onRestart(settings);
	}

	return { settings, setSettings, handleSubmit };
}
