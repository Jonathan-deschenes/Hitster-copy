import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import FormCard from "../components/FormCard";
import TextField from "../components/TextField";
import PasswordField from "../components/PasswordField";
import PublicLobbyTable from "../components/PublicLobbyTable";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { IconArrowRight } from "../components/icons/FormIcons";
import { usePublicLobbies } from "../hooks/usePublicLobbies";
import { useJoinGameForm } from "../hooks/useJoinGameForm";
import { StorageKeys, StorageUtility } from "../hooks/useStorage";

export default function JoinGame() {
	const { publicLobbies, loading: loadingPublicLobbies } = usePublicLobbies();
	const {
		player,
		setPlayer,
		code,
		setCode,
		isSearchingCode,
		selectedLobbyRow,
		password,
		setPassword,
		isSubmitting,
		error,
		selectLobby,
		handleCodeSearch,
		handleJoin,
		canSearchCode,
		canJoin,
	} = useJoinGameForm();

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
						// handle pseudoName saving in localstorage
						onChange={handlePseudoName}
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
				<p>Bludster · v0.1</p>
			</footer>
		</PageBackground>
	);
}
