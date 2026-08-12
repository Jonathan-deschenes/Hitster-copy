import { IconButton, PrimaryButton } from "../Button";
import HostActionButton from "./HostActionButton";
import ConnectSpotifyButton from "./ConnectSpotifyButton";
import SpotifyVolumeControl from "./SpotifyVolumeControl";
import {
	IconRefresh,
	IconSettings,
	IconSkip,
	IconUsers,
} from "../icons/GameIcons";
import {
	GameStatus,
	type GameStateEnum,
	type gameStateProps,
} from "../../types";

interface GameFooterProps {
	gameState?: gameStateProps;
	/** Host flag **and** a connected Spotify account — gates playback controls. */
	isHost: boolean;
	/** Host flag alone. A host without Spotify is the one who needs to connect. */
	isHostPlayer: boolean;
	hostActionByStatus: Record<GameStateEnum, () => void>;
	/** Last round of the game — relabels the host action, see `HostActionButton`. */
	isFinalRound: boolean;
	volume: number;
	onVolumeChange: (volume: number) => void;
	onLeave: () => void;
	onSkipTrack: () => void;
	onRestartGame: () => void;
	onOpenPlayers: () => void;
	onOpenSettings: () => void;
	canOpenPlayers: boolean;
}

export default function GameFooter({
	gameState,
	isHost,
	isHostPlayer,
	hostActionByStatus,
	isFinalRound,
	volume,
	onVolumeChange,
	onLeave,
	onSkipTrack,
	onRestartGame,
	onOpenPlayers,
	onOpenSettings,
	canOpenPlayers,
}: GameFooterProps) {
	const status = gameState?.status;
	const roundInFlight =
		status === GameStatus.Playing || status === GameStatus.Paused;
	// The podium owns the "nouvelle partie" call to action once the game is over,
	// so the footer stays out of its way.
	const gameOver = status === GameStatus.Ended;

	return (
		<footer className='relative z-10 flex flex-col items-end gap-3 px-4 pt-2 pb-4 sm:px-12 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4'>
			<PrimaryButton
				type='button'
				className='order-last w-full lg:order-none lg:w-fit lg:justify-self-start'
				onClick={onLeave}
			>
				Quitter la partie
			</PrimaryButton>
			<div></div>
			<div className='w-full lg:w-fit flex flex-wrap items-center justify-center gap-3 lg:justify-self-end'>
				{/* A host whose Spotify isn't connected is exactly who needs this. */}
				{isHostPlayer && !isHost && <ConnectSpotifyButton />}

				{gameState && isHost && !gameOver && (
					<HostActionButton
						status={gameState.status}
						isFinalRound={isFinalRound}
						onClick={hostActionByStatus[gameState.status]}
					/>
				)}

				{roundInFlight && isHost && (
					<IconButton
						label='Passer la musique'
						icon={<IconSkip />}
						onClick={onSkipTrack}
					/>
				)}

				{gameState && isHost && !gameOver && (
					<IconButton
						label='Relancer la partie'
						icon={<IconRefresh />}
						onClick={onRestartGame}
					/>
				)}

				<div className='flex gap-4'>
					{isHost && !gameOver && (
						<SpotifyVolumeControl volume={volume} onChange={onVolumeChange} />
					)}
					{canOpenPlayers && (
						<IconButton
							label='Gérer les joueurs'
							icon={<IconUsers />}
							className='lg:hidden'
							onClick={onOpenPlayers}
						/>
					)}
					{isHost && (
						<IconButton
							label='Paramètres'
							icon={<IconSettings />}
							className='lg:hidden'
							onClick={onOpenSettings}
						/>
					)}
				</div>
			</div>
		</footer>
	);
}
