import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import FormCard from "../components/FormCard";
import TextField from "../components/TextField";
import PasswordField from "../components/PasswordField";
import SelectField from "../components/SelectField";
import ToggleField from "../components/ToggleField";
import { PrimaryButton } from "../components/Button";
import { IconPlus } from "../components/icons/FormIcons";
import { musicStyle, roundsOptions } from "../constants/createGameOptions";
import { useCreateGameForm } from "../hooks/useCreateGameForm";
import { StorageKeys, StorageUtility } from "../hooks/useStorage";

export default function CreateGame() {
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

	// function to handle the pseudo storage saving
	const handlePseudoName = (
		event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
	) => {
		event.preventDefault();

		setPlayer((prev) => ({ ...prev, pseudo: event.target.value }));
		StorageUtility.setItem(StorageKeys.USER_NAME, event.target.value);
	};

	return (
		<PageBackground>
			<TopBar />

			<FormCard
				eyebrow='Nouvelle partie'
				title='Créer une nouvelle partie'
				subtitle="Configurez votre lobby avant d'inviter vos amis."
			>
				<form
					className='flex flex-col gap-6'
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
			</FormCard>

			<footer className='relative z-10 border-t border-lavender/14 px-6 pt-6 pb-8 text-center text-[0.8rem] text-lavender/44 sm:px-10 lg:px-16'>
				<p>Lorem ipsum dolor sit amet · v0.1 placeholder</p>
			</footer>
		</PageBackground>
	);
}
