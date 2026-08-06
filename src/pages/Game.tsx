import { useEffect, useMemo, useRef, useState } from "react";
import {
	Navigate,
	useLocation,
	useParams,
	useSearchParams,
} from "react-router-dom";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import { GameStatus, type GameStateEnum, type lobbyProps } from "../types";
import { PrimaryButton } from "../components/Button";
import { useLobbyRealtime } from "../hooks/useLobbyRealtime";
import { useGameActions } from "../hooks/useGameActions";
import LobbyHeaderBadges from "../components/game/LobbyHeaderBadges";
import AlbumArtPanel from "../components/game/AlbumArtPanel";
import ScoreboardPanel from "../components/game/ScoreboardPanel";
import GameStatusBadge from "../components/game/GameStatusBadge";
import HostActionButton from "../components/game/HostActionButton";
import PlayerAvatarList from "../components/game/PlayerAvatarList";
import ConnectSpotifyButton from "../components/game/ConnectSpotifyButton";
import SpotifyVolumeControl from "../components/game/SpotifyVolumeControl";
import { useMusicQueue } from "../hooks/useMusicQueue";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { isSpotifyConnected } from "../lib/spotify/auth";
import { updateGameStatus } from "../lib/lobbies";
import { showToast } from "../lib/toast";

export default function Game() {
	// Get current code and user
	const { code } = useParams<{ code: string }>();
	const [searchParams] = useSearchParams();
	const current = searchParams.get("current");

	// Fetch current lobby info
	const location = useLocation();
	const initialLobby = (location.state as lobbyProps | null) ?? null;

	const { lobby, notFound } = useLobbyRealtime(code, current, initialLobby);
	const { currentPlayer, handleLeaving, hostActionByStatus } = useGameActions({
		code,
		lobby,
		currentPlayerId: current,
	});

	// Musics queue, synced from the lobby row (generated once at creation)
	const [musicQueue, currentTrackIndex, incrementCurrentTrackIndex] =
		useMusicQueue(lobby?.music_queue, code);

	// current game state
	const gameState = lobby?.game_state;
	// current round timer
	const [counter, setCounter] = useState<number>(30);

	const prevStatus = useRef<GameStateEnum | undefined>(undefined);

	const isHost = !!currentPlayer?.host && isSpotifyConnected();
	const spotifyPlayer = useSpotifyPlayer({ enabled: isHost });

	useEffect(() => {
		if (spotifyPlayer.error) showToast(spotifyPlayer.error, "error");
	}, [spotifyPlayer.error]);

	const currentTrackId = musicQueue[currentTrackIndex]?.id;
	const playbackRef = useRef<{
		prevStatus?: GameStateEnum;
		lastPlayedTrackId?: string;
	}>({});

	useEffect(() => {
		if (!isHost || !spotifyPlayer.isReady || !gameState) return;

		const { prevStatus: previousStatus, lastPlayedTrackId } =
			playbackRef.current;
		const status = gameState.status;

		if (
			status === GameStatus.Playing &&
			currentTrackId &&
			currentTrackId !== lastPlayedTrackId
		) {
			spotifyPlayer.play(currentTrackId);
			playbackRef.current.lastPlayedTrackId = currentTrackId;
		} else if (
			status === GameStatus.Playing &&
			previousStatus === GameStatus.Paused
		) {
			spotifyPlayer.resume();
		} else if (
			status === GameStatus.Paused &&
			previousStatus !== GameStatus.Paused
		) {
			spotifyPlayer.pause();
		}

		playbackRef.current.prevStatus = status;
	}, [isHost, spotifyPlayer, gameState, currentTrackId]);

	useEffect(() => {
		// round start came from pause
		const cameFromPause = prevStatus.current === GameStatus.Paused;
		// round start came from finished
		const cameFromFinished = prevStatus.current === GameStatus.Finished;
		prevStatus.current = gameState?.status;

		if (gameState?.status !== GameStatus.Playing || !code) return;

		if (!cameFromPause) {
			setCounter(30);
		}

		if (cameFromFinished) incrementCurrentTrackIndex();

		const intervalId = setInterval(() => {
			setCounter((c) => {
				if (c <= 1) {
					clearInterval(intervalId);
					updateGameStatus(code, GameStatus.Finished);
					return 0;
				}
				return c - 1;
			});
		}, 1000);

		return () => clearInterval(intervalId);
	}, [gameState, code]);

	const scoredPlayers = useMemo(
		() =>
			(lobby?.player ?? []).map((player) => ({
				...player,
				score: 0,
			})),
		[lobby?.player],
	);

	// handle no route
	if (!code || notFound) {
		return <Navigate to='/' replace />;
	}

	// loading lobby
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

	return (
		<PageBackground>
			<TopBar />

			<LobbyHeaderBadges
				name={lobby.name}
				code={lobby.generatedCode}
				isPublic={lobby.public}
			/>

			<main className='relative z-10 flex flex-col justify-center items-center w-full gap-8 px-6 pt-6 pb-4 sm:px-10lg:px-16'>
				{(gameState?.status === GameStatus.Playing ||
					gameState?.status === GameStatus.Paused) && (
					<h2 className='z-20 absolute bottom-1/2 right-1/2 translate-x-1/2 translate-y-1/2 text-2xl text-lavender/85'>
						{counter}
					</h2>
				)}
				<div className='flex flex-col-reverse md:grid md:grid-cols-[1fr_auto_1fr] justify-center items-center w-full lg:flex-row lg:items-start lg:justify-center '>
					<div></div>
					<AlbumArtPanel
						currentTrack={musicQueue[currentTrackIndex]}
						gameState={gameState}
					/>
					<ScoreboardPanel players={scoredPlayers} currentPlayerId={current} />
				</div>
			</main>

			<footer className='relative z-10 flex flex-col-reverse md:flex-row justify-center px-4 pt-4 pb-7 sm:px-12'>
				<PrimaryButton
					type='submit'
					className='hidden md:absolute m-4 mt-8 md:mt-0 md:w-fit bottom-0 left-0'
					onClick={handleLeaving}
				>
					Quitter la partie
				</PrimaryButton>
				<div className='flex flex-col items-center gap-4'>
					{gameState && <GameStatusBadge gameState={gameState} />}

					{currentPlayer?.host && !isSpotifyConnected() && (
						<ConnectSpotifyButton />
					)}

					{gameState && currentPlayer?.host && isSpotifyConnected() && (
						<HostActionButton
							status={gameState.status}
							onClick={hostActionByStatus[gameState.status]}
						/>
					)}

					{isHost && (
						<SpotifyVolumeControl
							volume={spotifyPlayer.volume}
							onChange={spotifyPlayer.setVolume}
						/>
					)}

					<PlayerAvatarList players={lobby.player} currentPlayerId={current} />
				</div>
			</footer>
		</PageBackground>
	);
}
