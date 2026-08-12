import TextField from "./TextField";
import PasswordField from "./PasswordField";
import SelectField from "./SelectField";
import ToggleField from "./ToggleField";
import DurationSlider from "./DurationSlider";
import { PrimaryButton } from "./Button";
import { IconPlus } from "./icons/FormIcons";
import { gameModeOptions, musicStyle, roundsOptions } from "../constants/createGameOptions";
import { useCreateGameForm } from "../hooks/useCreateGameForm";
import { filterGameModesForCategory } from "../util";
import { useEffect, useMemo } from "react";

export default function CreateGameForm() {
	const {
		gameFormSettings,
		setGameFormSettings,
		player,
		handlePseudoName,
		isSubmitting,
		error,
		buttonDisabled,
		handleSubmit,
	} = useCreateGameForm();

	// Memoized so the effect below doesn't re-run on every render.
	const filteredGameMode = useMemo(
		() => filterGameModesForCategory(gameFormSettings.category.value),
		[gameFormSettings.category.value],
	);

	// Switching playlist can invalidate the selected mode — fall back to the
	// first one the new playlist actually offers.
	useEffect(() => {
		const stillValid = filteredGameMode.some(
			(option) => option.value === gameFormSettings.mode.value,
		);
		if (!stillValid) {
			setGameFormSettings((prev) => ({ ...prev, mode: filteredGameMode[0] }));
		}
	}, [filteredGameMode, gameFormSettings.mode.value, setGameFormSettings]);

	return (
		<form
			className='flex flex-col gap-3.5 sm:gap-5'
			onSubmit={(event) => handleSubmit(event)}
		>
			<TextField
				id='player-name'
				label='Nom du joueur'
				placeholder='pseudo'
				value={player.pseudo}
				onChange={handlePseudoName}
				autoComplete='off'
			/>

			<TextField
				id='lobby-name'
				label='Nom du lobby'
				placeholder='Lorem ipsum'
				onChange={(e) =>
					setGameFormSettings((prev) => ({ ...prev, name: e.target.value }))
				}
				autoComplete='off'
			/>

			<PasswordField
				id='lobby-password'
				label='Mot de passe'
				value={gameFormSettings.password}
				onChange={(e) =>
					setGameFormSettings((prev) => ({
						...prev,
						password: e.target.value,
					}))
				}
			/>

			<SelectField
				id='lobby-category'
				label='Catégorie musicale'
				value={gameFormSettings.category.value}
				onChange={(e) => {
					const category = musicStyle.find(
						(style) => style.value === e.target.value,
					);
					if (category) {
						setGameFormSettings((prev) => ({ ...prev, category }));
					}
				}}
				hint='Détermine les morceaux proposés pendant la partie.'
				options={musicStyle}
			/>

			<SelectField
				id='create-game-mode'
				label='Mode de jeu'
				value={gameFormSettings.mode.value}
				onChange={(e) => {
					const mode = gameModeOptions.find(
						(option) => option.value === e.target.value,
					);
					if (mode) {
						setGameFormSettings((prev) => ({ ...prev, mode }));
					}
				}}
				hint='Détermine ce que les joueurs doivent deviner.'
				options={filteredGameMode}
			/>

			<SelectField
				id='lobby-rounds'
				label='Nombre de manches'
				value={String(gameFormSettings.rounds)}
				onChange={(e) =>
					setGameFormSettings((prev) => ({
						...prev,
						rounds: Number(e.target.value),
					}))
				}
				hint='Nombre de morceaux à deviner avant la fin de la partie.'
				options={roundsOptions}
			/>

			<DurationSlider
				id='create-game-duration'
				value={gameFormSettings.duration}
				onChange={(duration) =>
					setGameFormSettings((prev) => ({ ...prev, duration }))
				}
			/>

			<ToggleField
				id='lobby-public'
				label='Partie publique'
				checked={gameFormSettings.public}
				onChange={(checked) =>
					setGameFormSettings((prev) => ({ ...prev, public: checked }))
				}
				hint={
					gameFormSettings.public
						? "Visible dans la liste des parties publiques."
						: "Accessible uniquement via un code d'invitation."
				}
			/>

			{error && (
				<p className='text-center text-[0.85rem] text-red-400'>{error}</p>
			)}

			<PrimaryButton
				type='submit'
				disabled={buttonDisabled}
				className='mt-1 w-full'
			>
				<IconPlus />
				{isSubmitting ? "Création…" : "Créer la partie"}
			</PrimaryButton>
		</form>
	);
}
