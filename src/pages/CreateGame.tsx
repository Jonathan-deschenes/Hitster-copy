import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import FormCard from "../components/FormCard";
import TextField from "../components/TextField";
import PasswordField from "../components/PasswordField";
import SelectField from "../components/SelectField";
import ToggleField from "../components/ToggleField";
import { PrimaryButton } from "../components/Button";
import {
	type playerProps,
	type gameCategoryProps,
	type createGameFormSettingsProps,
} from "../types";
import bcrypt from "bcryptjs-react";
import { createLobby } from "../lib/lobbies";
import generateUniqueId from "generate-unique-id";

const musicStyle: gameCategoryProps[] = [
	{ value: "5nhEJxO2ytt0rTdpydTsZV", label: "Summer party" },
	{ value: "0D5RyoJGBnIZ0bmCvgcDmf", label: "Francophone" },
	{ value: "6QrVkClF1eJSjb9FDfqtJ8", label: "Rock" },
];

function IconPlus() {
	return (
		<svg width='18' height='18' viewBox='0 0 18 18' fill='none'>
			<path
				d='M9 3v12M3 9h12'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
			/>
		</svg>
	);
}

export default function CreateGame() {
	const navigate = useNavigate();
	const [gameFormSettings, setGameFormSettings] =
		useState<createGameFormSettingsProps>({
			name: "",
			password: "",
			category: musicStyle[0],
			public: true,
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

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);

		try {
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = bcrypt.hashSync(gameFormSettings.password, salt);

			const lobby = await createLobby(
				{
					name: gameFormSettings.name,
					passwordHash: hashedPassword,
					category: gameFormSettings.category,
					public: gameFormSettings.public,
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
						onChange={(e) =>
							setPlayer((prev) => ({ ...prev, pseudo: e.target.value }))
						}
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
