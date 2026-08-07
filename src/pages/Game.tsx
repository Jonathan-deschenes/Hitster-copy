import { useEffect, useMemo, useRef, useState } from "react";
import {
	Navigate,
	useLocation,
	useParams,
	useSearchParams,
} from "react-router-dom";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import {
	GameStatus,
	type GameStateEnum,
	type lobbyProps,
	type lobbySettingsFormProps,
} from "../types";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { useLobbyRealtime } from "../hooks/useLobbyRealtime";
import { useGameActions } from "../hooks/useGameActions";
import LobbyHeaderBadges from "../components/game/LobbyHeaderBadges";
import AlbumArtPanel from "../components/game/AlbumArtPanel";
import ScoreboardPanel from "../components/game/ScoreboardPanel";
import Scoreboard from "../components/game/Scoreboard";
import LobbySettings from "../components/game/LobbySettings";
import LobbySettingsPanel from "../components/game/LobbySettingsPanel";
import GameStatusBadge from "../components/game/GameStatusBadge";
import HostActionButton from "../components/game/HostActionButton";
import PlayerAvatarList from "../components/game/PlayerAvatarList";
import ConnectSpotifyButton from "../components/game/ConnectSpotifyButton";
import SpotifyVolumeControl from "../components/game/SpotifyVolumeControl";
import Modal from "../components/Modal";
import {
	IconClose,
	IconSettings,
	IconUsers,
} from "../components/icons/GameIcons";
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

	const { lobby, notFound, kicked } = useLobbyRealtime(
		code,
		current,
		initialLobby,
	);
	const {
		currentPlayer,
		handleLeaving,
		handlePlayerKick,
		handlePlayerPromotion,
		hostActionByStatus,
	} = useGameActions({
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
	// host-only, mobile-only player management modal (kick/promote)
	const [manageOpen, setManageOpen] = useState(false);
	// host-only, mobile-only lobby settings modal
	const [settingsOpen, setSettingsOpen] = useState(false);

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
	}, [gameState, code, incrementCurrentTrackIndex]);

	const scoredPlayers = useMemo(
		() =>
			(lobby?.player ?? []).map((player) => ({
				...player,
				score: 0,
			})),
		[lobby?.player],
	);

	// TODO: persist settings + restart the round via a Supabase mutation
	function handleRestartGame(settings: lobbySettingsFormProps) {
		console.log("Restart game with settings", settings);
	}

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

	// handle redirection for kicked player
	if (kicked) return <Navigate to={"/"} />;

	return (
		<PageBackground>
			<TopBar />
			<main className='relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 px-4 py-2 sm:px-8 lg:px-12'>
				<div className='flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:content-stretch'>
					<div className='hidden min-h-0 lg:block'>
						{currentPlayer?.host && (
							<LobbySettingsPanel
								lobby={lobby}
								onRestart={handleRestartGame}
								className='hidden md:flex'
							/>
						)}
					</div>
					<div className='relative flex flex-col shrink-0 gap-y-4 items-center justify-center'>
						<LobbyHeaderBadges
							name={lobby.name}
							code={lobby.generatedCode}
							isPublic={lobby.public}
						/>
						<div className='relative w-full h-fit'>
							<AlbumArtPanel
								key={currentTrackId}
								currentTrack={musicQueue[currentTrackIndex]}
								gameState={gameState}
							/>
							{(gameState?.status === GameStatus.Playing ||
								gameState?.status === GameStatus.Paused) && (
								<h2 className='h-full pointer-events-none z-20 absolute inset-0 flex items-center justify-center text-2xl text-lavender/85'>
									{counter}
								</h2>
							)}
						</div>
						<div className='flex flex-col items-center justify-items-center gap-3'>
							{gameState && <GameStatusBadge gameState={gameState} />}
							<PlayerAvatarList
								players={scoredPlayers}
								currentPlayerId={current}
							/>
						</div>
					</div>
					<ScoreboardPanel
						players={scoredPlayers}
						currentPlayerId={current}
						canManagePlayers={!!currentPlayer?.host}
						kickAction={handlePlayerKick}
						promotionAction={handlePlayerPromotion}
						className='hidden min-h-0 lg:flex lg:justify-self-end'
					/>
				</div>
			</main>

			<footer className='relative z-10 flex flex-col items-end gap-3 px-4 pt-2 pb-4 sm:px-12 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4'>
				<PrimaryButton
					type='button'
					className='order-last w-full lg:w-auto lg:order-none lg:w-fit lg:justify-self-start'
					onClick={handleLeaving}
				>
					Quitter la partie
				</PrimaryButton>
				<div></div>
				<div className='w-full lg:w-fit flex flex-wrap items-center justify-center gap-3 lg:justify-self-end'>
					{currentPlayer?.host && !isSpotifyConnected() && (
						<ConnectSpotifyButton />
					)}

					{gameState && currentPlayer?.host && isSpotifyConnected() && (
						<HostActionButton
							status={gameState.status}
							onClick={hostActionByStatus[gameState.status]}
						/>
					)}

					<div className='flex gap-4'>
						{isHost && (
							<SpotifyVolumeControl
								volume={spotifyPlayer.volume}
								onChange={spotifyPlayer.setVolume}
							/>
						)}
						{currentPlayer?.host && (
							<SecondaryButton
								type='button'
								className='lg:hidden p-2!'
								aria-label='Gérer les joueurs'
								title='Gérer les joueurs'
								onClick={() => setManageOpen(true)}
							>
								<IconUsers />
							</SecondaryButton>
						)}

						{currentPlayer?.host && (
							<SecondaryButton
								type='button'
								className='lg:hidden !p-2'
								aria-label='Paramètres'
								title='Paramètres'
								onClick={() => setSettingsOpen(true)}
							>
								<IconSettings />
							</SecondaryButton>
						)}
					</div>
				</div>
			</footer>

			<Modal
				open={manageOpen}
				onClose={() => setManageOpen(false)}
				labelledBy='manage-players-title'
				size='md'
			>
				<div className='flex shrink-0 items-center justify-between gap-4 p-6 pb-4'>
					<h2
						id='manage-players-title'
						className='font-display text-lg font-bold'
					>
						Gérer les joueurs
					</h2>
					<button
						type='button'
						onClick={() => setManageOpen(false)}
						aria-label='Fermer'
						className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-lavender/14 bg-lavender/[0.04] text-lavender/68 transition-colors hover:border-purple-soft hover:bg-purple/[0.14] hover:text-white'
					>
						<IconClose />
					</button>
				</div>
				<div className='min-h-0 flex-1 overflow-y-auto px-6 pb-6'>
					<Scoreboard
						players={scoredPlayers}
						currentPlayerId={current}
						canManagePlayers={!!currentPlayer?.host}
						kickAction={handlePlayerKick}
						promotionAction={handlePlayerPromotion}
					/>
				</div>
			</Modal>

			<Modal
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				labelledBy='lobby-settings-title'
				size='md'
			>
				<div className='flex shrink-0 items-center justify-between gap-4 p-6 pb-4'>
					<h2
						id='lobby-settings-title'
						className='font-display text-lg font-bold'
					>
						Paramètres de la partie
					</h2>
					<button
						type='button'
						onClick={() => setSettingsOpen(false)}
						aria-label='Fermer'
						className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-lavender/14 bg-lavender/[0.04] text-lavender/68 transition-colors hover:border-purple-soft hover:bg-purple/[0.14] hover:text-white'
					>
						<IconClose />
					</button>
				</div>
				<div className='min-h-0 flex-1 overflow-y-auto px-6 pb-6'>
					<LobbySettings
						lobby={lobby}
						onRestart={(settings) => {
							handleRestartGame(settings);
							setSettingsOpen(false);
						}}
					/>
				</div>
			</Modal>
		</PageBackground>
	);
}
