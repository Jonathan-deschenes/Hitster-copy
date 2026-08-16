import { useState } from "react";
import {
	Navigate,
	useLocation,
	useParams,
	useSearchParams,
} from "react-router-dom";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import { GameStatus, type lobbyProps } from "../types";
import { useLobbyRealtime } from "../hooks/useLobbyRealtime";
import { useGameActions } from "../hooks/useGameActions";
import { useMusicQueue } from "../hooks/useMusicQueue";
import { useYoutubePlayer } from "../hooks/useYoutubePlayer";
import { useYoutubePlayback } from "../hooks/useYoutubePlayback";
import { resolvePlaybackIntent } from "../lib/playback";
import { useRoundLifecycle } from "../hooks/useRoundLifecycle";
import { useAnswerChime } from "../hooks/useAnswerChime";
import GameStage from "../components/game/GameStage";
import PodiumStage from "../components/game/PodiumStage";
import GameFooter from "../components/game/GameFooter";
import PlayersModal from "../components/game/PlayersModal";
import SettingsModal from "../components/game/SettingsModal";

export default function Game() {
	const { code } = useParams<{ code: string }>();
	const [searchParams] = useSearchParams();
	const current = searchParams.get("current");

	// Home hands the lobby over in router state so the first paint isn't a spinner.
	const location = useLocation();
	const initialLobby = (location.state as lobbyProps | null) ?? null;

	const { lobby, notFound, kicked } = useLobbyRealtime(
		code,
		current,
		initialLobby,
	);

	// One YouTube player per tab, for every player, not just the host: each
	// client now produces its own audio instead of only one shared device's.
	const youtubePlayer = useYoutubePlayer({ enabled: true });

	const {
		currentPlayer,
		finalRound,
		handleLeaving,
		handlePlayerKick,
		handlePlayerPromotion,
		handlePlayerAnswer,
		handleSkipTrack,
		handleRestartGame,
		hostActionByStatus,
	} = useGameActions({
		code,
		lobby,
		currentPlayerId: current,
		youtubePlayer,
	});

	// Read-only: `startRound` owns `current` server-side.
	const [musicQueue, currentTrackIndex] = useMusicQueue(lobby?.music_queue);
	const currentTrack = musicQueue[currentTrackIndex];

	const gameState = lobby?.game_state;

	// No separate "connected a device" flag anymore: playback needs no login,
	// so being the host player is the only thing that matters.
	const isHostPlayer = !!currentPlayer?.host;

	useYoutubePlayback({
		gameState,
		currentTrack,
		youtubePlayer,
	});

	// The "Activer le son" gesture must load a *real* track, not prime an empty
	// player — calling play() with nothing cued is what used to throw "invalid
	// parameter" immediately. Computed fresh so a stale intent from an earlier
	// render never drives the click, same reasoning as `useYoutubePlayback`'s
	// own reconciler.
	const unlockCandidateIds = currentTrack?.youtubeIds ?? [];
	const unlockIntent = resolvePlaybackIntent(gameState, unlockCandidateIds[0]);
	const canUnlock = unlockIntent.kind === "play";

	function handleUnlock() {
		if (unlockIntent.kind !== "play") return;
		youtubePlayer.unlock(unlockCandidateIds, unlockIntent.positionMs / 1000);
	}

	const answeredCount = lobby?.player.filter((p) => !!p.answer).length ?? 0;
	useAnswerChime({ answeredCount, enabled: isHostPlayer });

	const { counter } = useRoundLifecycle({
		code,
		gameState,
		isHostPlayer,
		currentTrack,
		answeredCount,
		playerCount: lobby?.player.length ?? 0,
	});

	// Mobile-only modals; on desktop these render as side panels.
	const [manageOpen, setManageOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);

	if (!code || notFound) return <Navigate to='/' replace />;

	if (!lobby) {
		return (
			<PageBackground>
				<TopBar />
				<main className='relative z-10 flex flex-1 items-center justify-center px-6 text-center text-lavender/68'>
					Chargement du lobby…
				</main>
			</PageBackground>
		);
	}

	// No auth: "not in the players array" is how a kick reaches this client.
	if (kicked || !current) return <Navigate to='/' />;

	const status = gameState?.status;

	// The host asked for a fresh game: same lobby, scores wiped, back to
	// `waiting` so they can retune the settings before starting again.
	async function handleNewGame() {
		await handleRestartGame();
	}

	return (
		<PageBackground>
			<TopBar />
			<div className='flex min-h-0 flex-1 flex-col overflow-y-auto lg:contents'>
				{status === GameStatus.Ended ? (
					<PodiumStage
						players={lobby.player}
						currentPlayerId={current}
						gameState={gameState}
						categoryLabel={lobby.category?.label}
						isHostPlayer={isHostPlayer}
						onNewGame={handleNewGame}
					/>
				) : (
					<GameStage
						lobby={lobby}
						currentPlayerId={current}
						gameState={gameState}
						currentTrack={currentTrack}
						counter={counter}
						showCounter={
							status === GameStatus.Playing || status === GameStatus.Paused
						}
						canManagePlayers={isHostPlayer}
						onSettingsOpenChange={setSettingsOpen}
						answerAction={handlePlayerAnswer}
						kickAction={handlePlayerKick}
						promotionAction={handlePlayerPromotion}
					/>
				)}

				<GameFooter
					gameState={gameState}
					isHostPlayer={isHostPlayer}
					hostActionByStatus={hostActionByStatus}
					isFinalRound={finalRound}
					isUnlocked={youtubePlayer.isUnlocked}
					canUnlock={canUnlock}
					onUnlock={handleUnlock}
					volume={youtubePlayer.volume}
					onVolumeChange={youtubePlayer.setVolume}
					onLeave={handleLeaving}
					onSkipTrack={handleSkipTrack}
					onRestartGame={handleRestartGame}
					onOpenPlayers={() => setManageOpen(true)}
					onOpenSettings={() => setSettingsOpen(true)}
					canOpenPlayers={!!currentPlayer}
				/>
			</div>

			<PlayersModal
				open={manageOpen}
				onClose={() => setManageOpen(false)}
				players={lobby.player}
				currentPlayerId={current}
				canManagePlayers={isHostPlayer}
				kickAction={handlePlayerKick}
				promotionAction={handlePlayerPromotion}
			/>

			<SettingsModal
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				lobby={lobby}
			/>
		</PageBackground>
	);
}
