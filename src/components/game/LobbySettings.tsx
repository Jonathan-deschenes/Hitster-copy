import SelectField from "../SelectField";
import ToggleField from "../ToggleField";
import DurationSlider from "../DurationSlider";
import { PrimaryButton } from "../Button";
import { IconNextRound } from "../icons/GameIcons";
import { musicStyle, roundsOptions } from "../../constants/createGameOptions";
import { useLobbySettingsForm } from "../../hooks/useLobbySettingsForm";
import { filterGameModesForCategory } from "../../util";
import type { lobbyProps } from "../../types";
import { useEffect, useMemo, type SetStateAction } from "react";

interface LobbySettingsProps {
	lobby: lobbyProps;
	mobileMenuClose: React.Dispatch<SetStateAction<boolean>>;
	desktopMenuClose: React.Dispatch<SetStateAction<boolean>>;
}

export default function LobbySettings({
	lobby,
	mobileMenuClose,
	desktopMenuClose,
}: LobbySettingsProps) {
	const { settings, setSettings, handleSubmit } = useLobbySettingsForm(
		lobby,
		mobileMenuClose,
		desktopMenuClose,
	);

	// Memoized so the effect below doesn't re-run on every render.
	const filteredGameMode = useMemo(
		() => filterGameModesForCategory(settings.category.value),
		[settings.category.value],
	);

	// Switching playlist can invalidate the selected mode — fall back to the
	// first one the new playlist actually offers.
	useEffect(() => {
		const stillValid = filteredGameMode.some(
			(option) => option.value === settings.mode,
		);
		if (!stillValid) {
			setSettings((prev) => ({ ...prev, mode: filteredGameMode[0].value }));
		}
	}, [filteredGameMode, setSettings, settings.mode]);

	return (
		<form className='flex flex-col gap-5' onSubmit={handleSubmit}>
			<SelectField
				id='lobby-settings-rounds'
				label='Nombre de manches'
				value={String(settings.rounds)}
				onChange={(e) =>
					setSettings((prev) => ({
						...prev,
						rounds: Number(e.target.value),
					}))
				}
				hint='Nombre de morceaux à deviner avant la fin de la partie.'
				options={roundsOptions}
			/>

			<SelectField
				id='lobby-settings-category'
				label='Playlist'
				value={settings.category.value}
				onChange={(e) => {
					const category = musicStyle.find(
						(style) => style.value === e.target.value,
					);
					if (category) {
						setSettings((prev) => ({ ...prev, category }));
					}
				}}
				hint='Détermine les morceaux proposés pendant la partie.'
				options={musicStyle}
			/>

			<SelectField
				id='lobby-settings-mode'
				label='Mode de jeu'
				value={settings.mode}
				onChange={(e) =>
					setSettings((prev) => ({ ...prev, mode: e.target.value }))
				}
				hint='Détermine ce que les joueurs doivent deviner.'
				options={filteredGameMode}
			/>

			<ToggleField
				id='lobby-settings-public'
				label='Partie publique'
				checked={settings.public}
				onChange={(checked) =>
					setSettings((prev) => ({ ...prev, public: checked }))
				}
				hint={
					settings.public
						? "Visible dans la liste des parties publiques."
						: "Accessible uniquement via un code d'invitation."
				}
			/>

			<DurationSlider
				id='lobby-settings-duration'
				value={settings.duration}
				onChange={(duration) => setSettings((prev) => ({ ...prev, duration }))}
			/>

			<PrimaryButton type='submit' className='mt-1 w-full'>
				<IconNextRound />
				Redémarrer la partie
			</PrimaryButton>
		</form>
	);
}
