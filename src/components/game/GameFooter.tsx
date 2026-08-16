import { IconButton, PrimaryButton } from "../Button";
import HostActionButton from "./HostActionButton";
import YoutubeVolumeControl from "./YoutubeVolumeControl";
import {
	IconRefresh,
	IconSettings,
	IconSkip,
	IconUsers,
	IconVolume,
} from "../icons/GameIcons";
import {
	GameStatus,
	type GameStateEnum,
	type gameStateProps,
} from "../../types";

interface GameFooterProps {
	gameState?: gameStateProps;
	/** Host flag — gates every playback and management control alike. */
	isHostPlayer: boolean;
	hostActionByStatus: Record<GameStateEnum, () => void>;
	/** Last round of the game — relabels the host action, see `HostActionButton`. */
	isFinalRound: boolean;
	/** Browsers block audio until a user gesture — the volume slider's slot doubles as that gesture. */
	isUnlocked: boolean;
	/** Whether there's an actual track to unlock with yet — see `Game.tsx`. */
	canUnlock: boolean;
	onUnlock: () => void;
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
	isHostPlayer,
	hostActionByStatus,
	isFinalRound,
	isUnlocked,
	canUnlock,
	onUnlock,
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
				{gameState && isHostPlayer && !gameOver && (
					<HostActionButton
						status={gameState.status}
						isFinalRound={isFinalRound}
						onClick={hostActionByStatus[gameState.status]}
					/>
				)}

				{roundInFlight && isHostPlayer && (
					<IconButton
						label='Passer la musique'
						icon={<IconSkip />}
						onClick={onSkipTrack}
					/>
				)}

				{gameState && isHostPlayer && !gameOver && (
					<IconButton
						label='Relancer la partie'
						icon={<IconRefresh />}
						onClick={onRestartGame}
					/>
				)}

				<div className='flex gap-4'>
					{!gameOver && isUnlocked && (
						<YoutubeVolumeControl volume={volume} onChange={onVolumeChange} />
					)}
					{!gameOver && !isUnlocked && canUnlock && (
						<IconButton
							label='Activer le son'
							icon={<IconVolume />}
							onClick={onUnlock}
						/>
					)}
					{canOpenPlayers && (
						<IconButton
							label='Gérer les joueurs'
							icon={<IconUsers />}
							className='lg:hidden'
							onClick={onOpenPlayers}
						/>
					)}
					{isHostPlayer && (
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
