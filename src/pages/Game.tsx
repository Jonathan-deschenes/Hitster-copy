import { useCallback, useEffect, useRef, useState } from "react";
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
	type musicItemsProps,
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
import LobbyQuestionBox from "../components/game/LobbyQuestionBox";
import GameStatusBadge from "../components/game/GameStatusBadge";
import HostActionButton from "../components/game/HostActionButton";
import PlayerAvatarList from "../components/game/PlayerAvatarList";
import ConnectSpotifyButton from "../components/game/ConnectSpotifyButton";
import SpotifyVolumeControl from "../components/game/SpotifyVolumeControl";
import Modal from "../components/Modal";
import {
	IconClose,
	IconRefresh,
	IconSettings,
	IconSkip,
	IconUsers,
} from "../components/icons/GameIcons";
import { useMusicQueue } from "../hooks/useMusicQueue";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { isSpotifyConnected } from "../lib/spotify/auth";
import { finishRound, updateGameStatus } from "../lib/lobbies";
import { updateGameSettings } from "../lib/lobbies/gameStateMutations";
import { showToast } from "../lib/toast";
import { DEFAULT_QUESTION } from "../constants/createGameOptions";

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
		handlePlayerAnswer,
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
	const isPlaying = gameState?.status === GameStatus.Playing;
	const isPaused = gameState?.status === GameStatus.Paused;
	const isWaiting = gameState?.status === GameStatus.Waiting;
	const isFinished = gameState?.status === GameStatus.Finished;

	// current round timer
	const [counter, setCounter] = useState<number>(gameState?.duration ?? 30);
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

	// Manual promotion leaves the outgoing host on this page (unlike leaving
	// the lobby, which pauses via handleLeaving before navigating away) — stop
	// their device the moment they lose the host flag via realtime.
	const wasHostRef = useRef(false);
	useEffect(() => {
		const isHostNow = !!currentPlayer?.host;
		if (wasHostRef.current && !isHostNow) {
			spotifyPlayer.pause();
		}
		wasHostRef.current = isHostNow;
	}, [currentPlayer?.host, spotifyPlayer]);

	const currentTrackId = musicQueue[currentTrackIndex]?.id;
	const playbackRef = useRef<{
		prevStatus?: GameStateEnum;
		lastPlayedTrackId?: string;
		failedTrackId?: string;
	}>({});

	const gameStatus = gameState?.status;
	useEffect(() => {
		if (!isHost || !spotifyPlayer.isReady || !gameStatus) return;

		const {
			prevStatus: previousStatus,
			lastPlayedTrackId,
			failedTrackId,
		} = playbackRef.current;
		const status = gameStatus;

		// A failed track is only held back for as long as the round keeps
		// running: any status change hands the host a fresh attempt at it.
		if (status !== GameStatus.Playing) {
			playbackRef.current.failedTrackId = undefined;
		}

		if (
			status === GameStatus.Playing &&
			currentTrackId &&
			currentTrackId !== lastPlayedTrackId &&
			currentTrackId !== failedTrackId
		) {
			playbackRef.current.lastPlayedTrackId = currentTrackId;
			spotifyPlayer.play(currentTrackId).then((started) => {
				if (started) return;
				// Nothing got loaded on the device, so a later `resume` would
				// have nothing to resume — another "Restriction violated". Drop
				// the track from "already played" so the next status change
				// starts it over, and remember the failure so reporting the
				// error (which re-renders, and re-runs this effect) can't spin
				// into a retry loop.
				playbackRef.current.lastPlayedTrackId = undefined;
				playbackRef.current.failedTrackId = currentTrackId;
			});
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
		} else if (
			status === GameStatus.Waiting &&
			previousStatus !== GameStatus.Waiting
		) {
			spotifyPlayer.pause();
			playbackRef.current.lastPlayedTrackId = undefined;
		}

		playbackRef.current.prevStatus = status;
	}, [isHost, spotifyPlayer, gameStatus, currentTrackId]);

	// Read from inside the interval callback, which outlives the render that
	// created it. Kept fresh here rather than in the timer's dependencies so a
	// player joining mid-round doesn't restart the countdown.
	const roundEndRef = useRef<{
		isHost: boolean;
		track?: musicItemsProps;
	}>({ isHost: false });
	useEffect(() => {
		roundEndRef.current = {
			isHost: !!currentPlayer?.host,
			track: musicQueue[currentTrackIndex],
		};
	}, [currentPlayer?.host, musicQueue, currentTrackIndex]);

	// Same reason: advancing the queue changes this callback's identity, and
	// that must not tear down the running countdown.
	const incrementTrackRef = useRef(incrementCurrentTrackIndex);
	useEffect(() => {
		incrementTrackRef.current = incrementCurrentTrackIndex;
	}, [incrementCurrentTrackIndex]);

	// Whether this client already submitted the current round's scores, so the
	// host can't pay the same answers out twice. Deliberately a flag cleared at
	// each countdown start rather than a round number: `updateGameSettings`
	// ("relancer la partie") puts `round` back to 0, and a remembered number
	// would then match the new game's first round and block it from ever ending.
	const roundFinalizedRef = useRef(false);

	// Both round-enders — the countdown hitting 0 and everyone having answered
	// — go through here, so the flag above still keeps the payout to one per
	// round whichever of them fires first. Identity is stable and the track
	// comes from a ref, because the interval callback below outlives the
	// render that created it.
	const finalizeRound = useCallback((lobbyCode: string) => {
		if (roundFinalizedRef.current) return;
		roundFinalizedRef.current = true;

		finishRound(lobbyCode, roundEndRef.current.track).catch((error) => {
			console.error(error);
			// Let a retry through, and make sure the round still ends even if
			// scoring failed.
			roundFinalizedRef.current = false;
			updateGameStatus(lobbyCode, GameStatus.Finished);
		});
	}, []);

	const roundDuration = gameState?.duration;
	useEffect(() => {
		const previousStatus = prevStatus.current;
		prevStatus.current = gameStatus;

		if (gameStatus !== GameStatus.Playing || !code) return;

		// A pause only freezes the countdown, so resuming picks the remaining
		// seconds back up. Anything else is a fresh round.
		if (previousStatus !== GameStatus.Paused) {
			setCounter(roundDuration ?? 30);
			roundFinalizedRef.current = false;
		}

		if (previousStatus === GameStatus.Finished) incrementTrackRef.current();

		const intervalId = setInterval(() => {
			setCounter((c) => {
				if (c <= 1) {
					clearInterval(intervalId);

					// Every client runs this timer, but only the host ends the
					// round: scoring reads and rewrites the whole players array,
					// so letting each browser do it would race the others into
					// clobbering scores. The rest just stop at 0 and wait for the
					// realtime update.
					if (roundEndRef.current.isHost) finalizeRound(code);
					return 0;
				}
				return c - 1;
			});
		}, 1000);

		return () => clearInterval(intervalId);
	}, [gameStatus, roundDuration, code, finalizeRound]);

	// Pops on the host's screen each time one more player has answered. The
	// single element is reused: the sound is short and this is the app's only
	// effect.
	const popRef = useRef<HTMLAudioElement | null>(null);
	const answeredCountRef = useRef<number | null>(null);

	const isHostPlayer = !!currentPlayer?.host;
	const answeredCount = lobby?.player.filter((p) => !!p.answer).length ?? 0;
	useEffect(() => {
		const previousCount = answeredCountRef.current;
		answeredCountRef.current = answeredCount;

		// `null` is the first observation (joining a round already under way
		// mustn't replay every answer), and a decrease is the reset between
		// rounds — only a new answer makes a sound.
		if (previousCount === null || answeredCount <= previousCount) return;
		if (!isHostPlayer) return;

		const pop = (popRef.current ??= new Audio("/sound/pop.mp3"));
		pop.currentTime = 0;
		// Browsers block autoplay until the page has been interacted with.
		pop.play().catch(() => {});
	}, [answeredCount, isHostPlayer]);

	// Nobody is left to answer, so there's no point running the countdown to
	// zero: reveal the track and pay out right away. Host-only and guarded by
	// `finalizeRound` for the same reason as the timer. Restricted to
	// `Playing` so a paused round stays paused even if the last answer lands
	// during the pause.
	const playerCount = lobby?.player.length ?? 0;
	useEffect(() => {
		if (!code || !isHostPlayer) return;
		if (gameStatus !== GameStatus.Playing) return;
		if (playerCount === 0 || answeredCount < playerCount) return;

		finalizeRound(code);
	}, [code, isHostPlayer, gameStatus, answeredCount, playerCount, finalizeRound]);

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
	if (kicked || !current) return <Navigate to={"/"} />;

	return (
		<PageBackground>
			<TopBar />
			<main className='relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 px-4 py-2 sm:px-8 lg:px-12'>
				<div className='flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:content-stretch'>
					<div className='hidden min-h-0 lg:flex lg:flex-col lg:gap-4'>
						{isHost && (
							<>
								<LobbySettingsPanel
									lobby={lobby}
									mobileMenuClose={setSettingsOpen}
									className='hidden md:flex'
								/>
							</>
						)}
						<LobbyQuestionBox
							className='block'
							question={gameState?.question ?? DEFAULT_QUESTION}
							answerAction={handlePlayerAnswer}
							currentPlayer={current}
							gameState={gameState}
							players={lobby.player}
							currentTrack={musicQueue[currentTrackIndex]}
						/>
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
							{(isPlaying || isPaused) && (
								<h2 className='h-full pointer-events-none z-20 absolute inset-0 flex items-center justify-center text-2xl text-lavender/85'>
									{counter}
								</h2>
							)}
						</div>
						<div className='flex flex-col items-center justify-items-center gap-3'>
							{gameState && <GameStatusBadge gameState={gameState} />}
							<PlayerAvatarList
								players={lobby.player}
								currentPlayerId={current}
							/>
						</div>
					</div>
					<ScoreboardPanel
						players={lobby.player}
						currentPlayerId={current}
						canManagePlayers={!!isHost}
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
					{isHost && !isSpotifyConnected() && <ConnectSpotifyButton />}

					{gameState && isHost && isSpotifyConnected() && (
						<HostActionButton
							status={gameState.status}
							onClick={hostActionByStatus[gameState.status]}
						/>
					)}

					{!isWaiting && !isFinished && isHost && (
						<SecondaryButton
							type='button'
							className='p-2!'
							aria-label='Passer la musique'
							title='Passer la musique'
							onClick={() =>
								code && finishRound(code, musicQueue[currentTrackIndex])
							}
						>
							<IconSkip />
						</SecondaryButton>
					)}

					{gameState && isHost && (
						<SecondaryButton
							type='button'
							className='p-2!'
							aria-label='Relancer la partie'
							title='Relancer la partie'
							onClick={() =>
								code &&
								updateGameSettings(code, {
									mode: gameState.mode,
									rounds: gameState.totalRounds,
									category: lobby.category,
									public: lobby.public,
									duration: gameState.duration,
								})
							}
						>
							<IconRefresh />
						</SecondaryButton>
					)}

					<div className='flex gap-4'>
						{isHost && (
							<SpotifyVolumeControl
								volume={spotifyPlayer.volume}
								onChange={spotifyPlayer.setVolume}
							/>
						)}
						{currentPlayer && (
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

						{isHost && (
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
						{isHost ? "Gérer les joueurs" : "Classement"}
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
						players={lobby.player}
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
						mobileMenuClose={setSettingsOpen}
						desktopMenuClose={setSettingsOpen}
					/>
				</div>
			</Modal>
		</PageBackground>
	);
}
