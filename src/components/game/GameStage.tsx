import { useState } from "react";
import LobbyHeaderBadges from "./LobbyHeaderBadges";
import AlbumArtPanel from "./AlbumArtPanel";
import ScoreboardPanel from "./ScoreboardPanel";
import LobbySettingsPanel from "./LobbySettingsPanel";
import LobbyQuestionBox from "./LobbyQuestionBox";
import GameStatusBadge from "./GameStatusBadge";
import PlayerAvatarList from "./PlayerAvatarList";
import { DEFAULT_QUESTION } from "../../constants/createGameOptions";
import { GameStatus } from "../../types";
import type { gameStateProps, lobbyProps, musicItemsProps, playbackTrackProps } from "../../types";

interface GameStageProps {
	lobby: lobbyProps;
	currentPlayerId: string;
	gameState?: gameStateProps;
	currentTrack?: playbackTrackProps;
	revealedTrack?: musicItemsProps;
	counter: number;
	/** Playing or paused — the round clock overlays the album art. */
	showCounter: boolean;
	/** Host flag — gates the settings panel and kick/promote alike. */
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
	revealedTrack,
	counter,
	showCounter,
	canManagePlayers,
	onSettingsOpenChange,
	answerAction,
	kickAction,
	promotionAction,
}: GameStageProps) {
	// Mobile shows the answer box (or, once revealed, the round result) in place
	// of the avatar strip: both don't fit above the album art. `waiting` keeps
	// the strip — that's the lobby view, where seeing who joined is the point.
	const status = gameState?.status;
	const showAnswerBox =
		status === GameStatus.Playing ||
		status === GameStatus.Paused ||
		status === GameStatus.Finished;

	// Lives here rather than inside the panel: expanding the settings puts the
	// question box below into its compact form, so the two share the flag and
	// the settings get the height they need.
	const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

	// No `min-h-0` on mobile: the stage takes its content's height and the page
	// scroller in `Game.tsx` handles the overflow. Desktop keeps it, so the three
	// columns scroll inside a locked viewport instead.
	return (
		<main className='relative z-10 flex w-full flex-1 flex-col items-center gap-4 px-4 py-2 sm:px-8 lg:min-h-0 lg:justify-center lg:px-12'>
			<div className='my-auto flex w-full flex-1 flex-col items-center justify-center gap-6 lg:my-0 lg:grid lg:min-h-0 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:content-stretch'>
				<div className='hidden min-h-0 lg:flex lg:flex-col lg:gap-4'>
					{canManagePlayers && (
						<LobbySettingsPanel
							lobby={lobby}
							isOpen={settingsPanelOpen}
							onOpenChange={setSettingsPanelOpen}
							mobileMenuClose={onSettingsOpenChange}
						/>
					)}
					<LobbyQuestionBox
						compact={canManagePlayers && settingsPanelOpen}
						question={gameState?.question ?? DEFAULT_QUESTION}
						answerAction={answerAction}
						currentPlayer={currentPlayerId}
						gameState={gameState}
						players={lobby.player}
						currentTrack={revealedTrack}
					/>
				</div>

				<div className='relative flex w-full max-w-md flex-col shrink-0 gap-y-4 items-center justify-center lg:w-auto lg:max-w-none'>
					<LobbyHeaderBadges
						name={lobby.name}
						code={lobby.generatedCode}
						isPublic={lobby.public}
					/>

					{showAnswerBox && (
						<LobbyQuestionBox
							className='lg:hidden'
							compact
							inputId='lobby-question-answer-mobile'
							question={gameState?.question ?? DEFAULT_QUESTION}
							answerAction={answerAction}
							currentPlayer={currentPlayerId}
							gameState={gameState}
							players={lobby.player}
							currentTrack={revealedTrack}
						/>
					)}

					{/* The panel is a fixed width, so it needs centring now that the
					    column is full-width on mobile. */}
					<div className='relative flex w-full h-fit justify-center'>
						{/* Keyed so a new track remounts the reveal animation. */}
						<AlbumArtPanel
							key={currentTrack?.trackId}
							currentTrack={revealedTrack}
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
							className={showAnswerBox ? "hidden lg:flex" : ""}
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
