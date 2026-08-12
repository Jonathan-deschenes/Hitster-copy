import LobbyHeaderBadges from "./LobbyHeaderBadges";
import AlbumArtPanel from "./AlbumArtPanel";
import ScoreboardPanel from "./ScoreboardPanel";
import LobbySettingsPanel from "./LobbySettingsPanel";
import LobbyQuestionBox from "./LobbyQuestionBox";
import GameStatusBadge from "./GameStatusBadge";
import PlayerAvatarList from "./PlayerAvatarList";
import { DEFAULT_QUESTION } from "../../constants/createGameOptions";
import type { gameStateProps, lobbyProps, musicItemsProps } from "../../types";

interface GameStageProps {
	lobby: lobbyProps;
	currentPlayerId: string;
	gameState?: gameStateProps;
	currentTrack?: musicItemsProps;
	counter: number;
	/** Playing or paused — the round clock overlays the album art. */
	showCounter: boolean;
	/** Host with a connected device: the settings panel restarts the game. */
	isHost: boolean;
	/** Host flag alone — kick/promote is not playback. */
	canManagePlayers: boolean;
	onSettingsOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
	answerAction: (answer: string, playerId: string) => Promise<void>;
	kickAction: (playerId: string) => void;
	promotionAction: (playerId: string) => void;
}

export default function GameStage({
	lobby,
	currentPlayerId,
	gameState,
	currentTrack,
	counter,
	showCounter,
	isHost,
	canManagePlayers,
	onSettingsOpenChange,
	answerAction,
	kickAction,
	promotionAction,
}: GameStageProps) {
	return (
		<main className='relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 px-4 py-2 sm:px-8 lg:px-12'>
			<div className='flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:content-stretch'>
				<div className='hidden min-h-0 lg:flex lg:flex-col lg:gap-4'>
					{isHost && (
						<LobbySettingsPanel
							lobby={lobby}
							mobileMenuClose={onSettingsOpenChange}
						/>
					)}
					<LobbyQuestionBox
						question={gameState?.question ?? DEFAULT_QUESTION}
						answerAction={answerAction}
						currentPlayer={currentPlayerId}
						gameState={gameState}
						players={lobby.player}
						currentTrack={currentTrack}
					/>
				</div>

				<div className='relative flex flex-col shrink-0 gap-y-4 items-center justify-center'>
					<LobbyHeaderBadges
						name={lobby.name}
						code={lobby.generatedCode}
						isPublic={lobby.public}
					/>
					<div className='relative w-full h-fit'>
						{/* Keyed so a new track remounts the reveal animation. */}
						<AlbumArtPanel
							key={currentTrack?.id}
							currentTrack={currentTrack}
							gameState={gameState}
						/>
						{showCounter && (
							<h2 className='h-full pointer-events-none z-20 absolute inset-0 flex items-center justify-center text-2xl text-lavender/85'>
								{counter}
							</h2>
						)}
					</div>
					<div className='flex flex-col items-center justify-items-center gap-3'>
						{gameState && <GameStatusBadge gameState={gameState} />}
						<PlayerAvatarList
							players={lobby.player}
							currentPlayerId={currentPlayerId}
						/>
					</div>
				</div>

				<ScoreboardPanel
					players={lobby.player}
					currentPlayerId={currentPlayerId}
					canManagePlayers={canManagePlayers}
					kickAction={kickAction}
					promotionAction={promotionAction}
					className='hidden min-h-0 lg:flex lg:justify-self-end'
				/>
			</div>
		</main>
	);
}
