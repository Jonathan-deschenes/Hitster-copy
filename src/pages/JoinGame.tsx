import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import FormCard from "../components/FormCard";
import TextField from "../components/TextField";
import PasswordField from "../components/PasswordField";
import PublicLobbyTable from "../components/PublicLobbyTable";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { lobbyRowProps, playerProps } from "../types";
import bcrypt from "bcryptjs-react";
import {
	findLobbyRowByCode,
	findPublicLobbies,
	joinLobby,
	subscribeToPublicLobbies,
} from "../lib/lobbies";
import generateUniqueId from "generate-unique-id";

function IconArrowRight() {
	return (
		<svg width='18' height='18' viewBox='0 0 18 18' fill='none'>
			<path
				d='M3.5 9h11M9.5 4l5 5-5 5'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	);
}

export default function JoinGame() {
	const navigate = useNavigate();
	const [player, setPlayer] = useState<playerProps>({
		id: generateUniqueId(),
		pseudo: "",
	});

	const [publicLobbies, setPublicLobbies] = useState<lobbyRowProps[]>([]);
	const [loadingPublicLobbies, setLoadingPublicLobbies] = useState(true);

	const [code, setCode] = useState("");
	const [isSearchingCode, setIsSearchingCode] = useState(false);

	const [selectedLobbyRow, setSelectedLobbyRow] =
		useState<lobbyRowProps | null>(null);
	const [password, setPassword] = useState("");

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		findPublicLobbies()
			.then(setPublicLobbies)
			.finally(() => setLoadingPublicLobbies(false));

		const unsubscribe = subscribeToPublicLobbies(setPublicLobbies);

		return unsubscribe;
	}, []);

	function selectLobby(row: lobbyRowProps) {
		setError(null);
		setPassword("");
		setSelectedLobbyRow(row);
	}

	async function handleCodeSearch() {
		if (!code) return;

		setError(null);
		setIsSearchingCode(true);

		try {
			const row = await findLobbyRowByCode(code);
			if (!row) {
				setError("Aucun lobby ne correspond à ce code.");
				return;
			}
			selectLobby(row);
		} catch (err) {
			console.error(err);
			setError("Une erreur est survenue, réessaie.");
		} finally {
			setIsSearchingCode(false);
		}
	}

	async function handleJoin(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedLobbyRow) return;

		setError(null);
		setIsSubmitting(true);

		try {
			const passwordMatches = bcrypt.compareSync(
				password,
				selectedLobbyRow.password_hash,
			);
			if (!passwordMatches) {
				setError("Mot de passe incorrect.");
				return;
			}

			const lobby = await joinLobby(selectedLobbyRow, player);
			navigate(`/game/${lobby.generatedCode}?current=${player.id}`, {
				state: lobby,
			});
		} catch (err) {
			console.error(err);
			setError("Une erreur est survenue, réessaie.");
		} finally {
			setIsSubmitting(false);
		}
	}

	const canSearchCode = player.pseudo !== "" && code !== "" && !isSearchingCode;
	const canJoin =
		player.pseudo !== "" &&
		password !== "" &&
		selectedLobbyRow !== null &&
		!isSubmitting;

	return (
		<PageBackground>
			<TopBar />

			<FormCard
				eyebrow='Rejoindre une partie'
				title='Rejoindre une partie'
				subtitle='Choisis une partie publique dans la liste, ou entre un code pour rejoindre une partie privée.'
			>
				<div className='flex flex-col gap-6'>
					<TextField
						id='player-name'
						label='Pseudo'
						placeholder='Lorem ipsum'
						value={player.pseudo}
						onChange={(e) =>
							setPlayer((prev) => ({ ...prev, pseudo: e.target.value }))
						}
						autoComplete='off'
					/>

					<div className='flex flex-col gap-2'>
						<label htmlFor='lobby-code' className='text-[0.9rem] font-semibold'>
							Code d&apos;invitation{" "}
							<span className='font-normal text-lavender/44'>
								(pour une partie privée)
							</span>
						</label>
						<div className='flex gap-3'>
							<input
								id='lobby-code'
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder='XXXX'
								autoComplete='off'
								className='w-full rounded-xl border border-lavender/14 bg-bg-deep/55 px-4 py-3.5 text-[0.95rem] text-inherit transition-colors duration-200 placeholder:text-lavender/44 hover:border-lavender/28 focus:border-purple-soft focus:bg-purple/[0.08] focus:shadow-[0_0_0_3px_rgba(126,20,255,0.22)] focus:outline-none'
							/>
							<SecondaryButton
								type='button'
								disabled={!canSearchCode}
								onClick={handleCodeSearch}
								className='shrink-0'
							>
								{isSearchingCode ? "Recherche…" : "Chercher"}
							</SecondaryButton>
						</div>
					</div>

					<div className='flex flex-col gap-3'>
						<span className='text-[0.9rem] font-semibold'>
							Parties publiques
						</span>
						<PublicLobbyTable
							lobbies={publicLobbies}
							selectedCode={selectedLobbyRow?.code ?? null}
							onSelect={selectLobby}
							loading={loadingPublicLobbies}
						/>
					</div>

					{selectedLobbyRow && (
						<form
							onSubmit={handleJoin}
							className='flex flex-col gap-6 rounded-2xl border border-lavender/14 bg-lavender/[0.04] p-5'
						>
							<p className='text-[0.9rem]'>
								Rejoindre{" "}
								<span className='font-semibold text-accent-blue'>
									{selectedLobbyRow.name}
								</span>
							</p>

							<PasswordField
								id='lobby-password'
								label='Mot de passe'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>

							<PrimaryButton
								type='submit'
								disabled={!canJoin}
								className='w-full'
							>
								<IconArrowRight />
								{isSubmitting ? "Connexion…" : "Rejoindre la partie"}
							</PrimaryButton>
						</form>
					)}

					{error && (
						<p className='text-center text-[0.85rem] text-red-400'>{error}</p>
					)}
				</div>
			</FormCard>

			<footer className='relative z-10 border-t border-lavender/14 px-6 pt-6 pb-8 text-center text-[0.8rem] text-lavender/44 sm:px-10 lg:px-16'>
				<p>Lorem ipsum dolor sit amet · v0.1 placeholder</p>
			</footer>
		</PageBackground>
	);
}
