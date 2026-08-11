import SelectField from "../SelectField";
import ToggleField from "../ToggleField";
import { PrimaryButton } from "../Button";
import { IconNextRound } from "../icons/GameIcons";
import {
	musicStyle,
	roundsOptions,
	gameModeOptions,
	DURATION_MIN,
	DURATION_MAX,
	DURATION_STEP,
} from "../../constants/createGameOptions";
import { useLobbySettingsForm } from "../../hooks/useLobbySettingsForm";
import type { gameCategoryProps, lobbyProps } from "../../types";
import { useEffect, type SetStateAction } from "react";

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

	const gameCategory: string = settings.category.label;
	const gameMode: gameCategoryProps[] = gameModeOptions;

	const filteredGameMode =
		gameCategory === musicStyle[3].label || gameCategory === musicStyle[4].label
			? gameMode.filter((g) => g.label === "Titre")
			: gameMode.slice(0, -1);

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

			<div className='flex flex-col gap-2'>
				<label
					htmlFor='lobby-settings-duration'
					className='text-[0.9rem] font-semibold'
				>
					Durée des extraits
				</label>
				<div className='flex items-center gap-3 rounded-2xl border border-lavender/14 bg-bg-deep/35 px-4 py-3.5'>
					<input
						id='lobby-settings-duration'
						type='range'
						min={DURATION_MIN}
						max={DURATION_MAX}
						step={DURATION_STEP}
						value={settings.duration}
						onChange={(e) =>
							setSettings((prev) => ({
								...prev,
								duration: Number(e.target.value),
							}))
						}
						className='w-full accent-accent-blue'
					/>
					<span className='w-10 shrink-0 text-right text-[0.9rem] text-lavender/68'>
						{settings.duration}s
					</span>
				</div>
			</div>

			<PrimaryButton type='submit' className='mt-1 w-full'>
				<IconNextRound />
				Redémarrer la partie
			</PrimaryButton>
		</form>
	);
}
