import TextField from "./TextField";
import PasswordField from "./PasswordField";
import PublicLobbyTable from "./PublicLobbyTable";
import { PrimaryButton, SecondaryButton } from "./Button";
import { IconArrowRight } from "./icons/FormIcons";
import { usePublicLobbies } from "../hooks/usePublicLobbies";
import { useJoinGameForm } from "../hooks/useJoinGameForm";

export default function JoinGameForm() {
	const { publicLobbies, loading: loadingPublicLobbies } = usePublicLobbies();
	const {
		player,
		handlePseudoName,
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

	return (
		<div className='flex flex-col gap-5'>
			<TextField
				id='player-name'
				label='Pseudo'
				placeholder='Lorem ipsum'
				value={player.pseudo}
				// handle pseudoName saving in localstorage
				onChange={handlePseudoName}
				autoComplete='off'
			/>

			<div className='flex items-end gap-3'>
				<div className='flex-1'>
					<TextField
						id='lobby-code'
						label="Code d'invitation (partie privée)"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						placeholder='XXXX'
						autoComplete='off'
					/>
				</div>
				<SecondaryButton
					type='button'
					disabled={!canSearchCode}
					onClick={handleCodeSearch}
					className='shrink-0'
				>
					{isSearchingCode ? "Recherche…" : "Chercher"}
				</SecondaryButton>
			</div>

			<div className='flex min-h-0 flex-1 flex-col gap-3'>
				<span className='field-label'>Parties publiques</span>
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
					className='flex flex-col gap-5 rounded-2xl border border-lavender/14 bg-lavender/[0.04] p-5'
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

					<PrimaryButton type='submit' disabled={!canJoin} className='w-full'>
						<IconArrowRight />
						{isSubmitting ? "Connexion…" : "Rejoindre la partie"}
					</PrimaryButton>
				</form>
			)}

			{error && (
				<p className='text-center text-[0.85rem] text-red-400'>{error}</p>
			)}
		</div>
	);
}
