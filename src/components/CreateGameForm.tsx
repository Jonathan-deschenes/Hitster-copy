import TextField from "./TextField";
import PasswordField from "./PasswordField";
import SelectField from "./SelectField";
import ToggleField from "./ToggleField";
import { PrimaryButton } from "./Button";
import { IconPlus } from "./icons/FormIcons";
import {
	DURATION_MAX,
	DURATION_MIN,
	DURATION_STEP,
	gameModeOptions,
	musicStyle,
	roundsOptions,
} from "../constants/createGameOptions";
import { useCreateGameForm } from "../hooks/useCreateGameForm";
import { StorageKeys, StorageUtility } from "../hooks/useStorage";
import type { gameCategoryProps } from "../types";
import { useEffect } from "react";

export default function CreateGameForm() {
	const {
		gameFormSettings,
		setGameFormSettings,
		player,
		setPlayer,
		isSubmitting,
		error,
		buttonDisabled,
		handleSubmit,
	} = useCreateGameForm();

	const gameCategory: string = gameFormSettings.category.label;
	const gameMode: gameCategoryProps[] = gameModeOptions;

	const filteredGameMode =
		gameCategory === musicStyle[3].label || gameCategory === musicStyle[4].label
			? gameMode.filter((g) => g.label === "Titre")
			: gameMode.slice(0, -1);

	useEffect(() => {
		const stillValid = filteredGameMode.some(
			(option) => option.value === gameFormSettings.mode.value,
		);
		if (!stillValid) {
			setGameFormSettings((prev) => ({ ...prev, mode: filteredGameMode[0] }));
		}
	}, [filteredGameMode, gameFormSettings.mode.value, setGameFormSettings]);

	// function to handle the pseudo storage saving
	const handlePseudoName = (
		event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
	) => {
		event.preventDefault();

		setPlayer((prev) => ({ ...prev, pseudo: event.target.value }));
		StorageUtility.setItem(StorageKeys.USER_NAME, event.target.value);
	};

	return (
		<form
			className='flex flex-col gap-5'
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
				id='lobby-settings-mode'
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
						value={gameFormSettings.duration}
						onChange={(e) =>
							setGameFormSettings((prev) => ({
								...prev,
								duration: Number(e.target.value),
							}))
						}
						className='w-full accent-accent-blue'
					/>
					<span className='w-10 shrink-0 text-right text-[0.9rem] text-lavender/68'>
						{gameFormSettings.duration}s
					</span>
				</div>
			</div>

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
