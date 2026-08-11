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
import { remainingSeconds, resolvePlaybackIntent } from "../lib/playback";
import type { PlaybackIntent } from "../lib/playback";
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

	// Musics queue, synced from the lobby row (generated once at creation).
	// Read-only: `startRound` owns `current` server-side.
	const [musicQueue, currentTrackIndex] = useMusicQueue(lobby?.music_queue);

	// current game state
	const gameState = lobby?.game_state;
	const isPlaying = gameState?.status === GameStatus.Playing;
	const isPaused = gameState?.status === GameStatus.Paused;
	const isWaiting = gameState?.status === GameStatus.Waiting;
	const isFinished = gameState?.status === GameStatus.Finished;

	// Drives the round timer: the countdown is derived from `gameState`'s clock,
	// so all this holds is "when is now" to recompute it against.
	const [now, setNow] = useState(() => Date.now());
	// host-only, mobile-only player management modal (kick/promote)
	const [manageOpen, setManageOpen] = useState(false);
	// host-only, mobile-only lobby settings modal
	const [settingsOpen, setSettingsOpen] = useState(false);

	const prevStatus = useRef<GameStateEnum | undefined>(undefined);

	// Scoring duty, which a host without Spotify still owes. Distinct from
	// `isHost` below, which additionally requires a connected device and gates
	// playback only.
	const isHostPlayer = !!currentPlayer?.host;
	const isHost = isHostPlayer && isSpotifyConnected();
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
	const gameStatus = gameState?.status;

	// What this device has already been told to do, so an identical intent
	// issues no command. Not a model of the game: the intent itself comes from
	// the lobby row on every render (see `resolvePlaybackIntent`), this only
	// dedupes the commands.
	const appliedRef = useRef<{
		kind?: PlaybackIntent["kind"];
		trackId?: string;
		/** Held back so reporting an error — which re-renders — can't spin into a retry loop. */
		failedTrackId?: string;
	}>({});

	const wasHostForPlaybackRef = useRef(isHost);

	useEffect(() => {
		// A player who was never host has issued nothing on their device — this
		// effect early-returns while `!isHost`, so `appliedRef` stayed empty.
		// Clearing it on promotion makes that explicit rather than accidental,
		// and is what stops a fresh host from acting on beliefs it never formed.
		const wasHost = wasHostForPlaybackRef.current;
		wasHostForPlaybackRef.current = isHost;
		if (isHost && !wasHost) appliedRef.current = {};

		if (!isHost || !spotifyPlayer.isReady || !gameState) return;

		// Read the clock at command time, not render time: the position the
		// track should start at is "now", not whenever React last rendered.
		const intent = resolvePlaybackIntent(gameState, currentTrackId);
		const applied = appliedRef.current;

		// A failed track is only held back while the round keeps running: any
		// other intent hands the host a fresh attempt at it.
		if (intent.kind !== "play") applied.failedTrackId = undefined;

		if (intent.kind === "idle") return;

		if (intent.kind === "pause") {
			if (applied.kind === "pause") return;
			appliedRef.current = { kind: "pause" };
			spotifyPlayer.pause();
			return;
		}

		// Already playing this exact track on this device — re-rendering (a
		// volume change, an error toast, another player answering) must not
		// restart it from the round's current position.
		if (applied.kind === "play" && applied.trackId === intent.trackId) return;
		if (applied.failedTrackId === intent.trackId) return;

		appliedRef.current = { kind: "play", trackId: intent.trackId };
		spotifyPlayer
			.resume(intent.trackId, intent.positionMs)
			.then((started) => {
				if (started) return;

				// A newer intent already took over (this one was superseded, or
				// the round moved on while it was in flight) — its own result
				// governs, so don't overwrite it.
				const applied = appliedRef.current;
				if (applied.kind !== "play" || applied.trackId !== intent.trackId) {
					return;
				}

				// Nothing got loaded, so remember the failure: reporting the
				// error re-renders, which re-runs this effect, and without this
				// it would spin into a retry loop.
				appliedRef.current = { kind: undefined, failedTrackId: intent.trackId };
			});
	}, [isHost, spotifyPlayer, gameState, currentTrackId]);

	// Kept in a ref so `finalizeRound` can stay identity-stable: it is a
	// dependency of the effects that end the round, and a new identity on every
	// queue update would re-run them.
	const roundTrackRef = useRef<musicItemsProps | undefined>(undefined);
	useEffect(() => {
		roundTrackRef.current = musicQueue[currentTrackIndex];
	}, [musicQueue, currentTrackIndex]);

	// Whether this client already submitted the current round's scores, so the
	// host can't pay the same answers out twice. Deliberately a flag cleared at
	// each countdown start rather than a round number: `updateGameSettings`
	// ("relancer la partie") puts `round` back to 0, and a remembered number
	// would then match the new game's first round and block it from ever ending.
	const roundFinalizedRef = useRef(false);

	// Both round-enders — the countdown hitting 0 and everyone having answered
	// — go through here, so the flag above still keeps the payout to one per
	// round whichever of them fires first.
	const finalizeRound = useCallback((lobbyCode: string) => {
		if (roundFinalizedRef.current) return;
		roundFinalizedRef.current = true;

		finishRound(lobbyCode, roundTrackRef.current).catch((error) => {
			console.error(error);
			// Let a retry through, and make sure the round still ends even if
			// scoring failed.
			roundFinalizedRef.current = false;
			updateGameStatus(lobbyCode, GameStatus.Finished);
		});
	}, []);

	// The countdown is *derived* from the round clock in the lobby row rather
	// than decremented locally, so every client shows the same second, a
	// mid-round refresh lands where the round actually is, and a settings write
	// can no longer restart the timer (and re-arm a second payout) mid-round.
	// This only paces the re-renders that recompute it.
	useEffect(() => {
		if (!isPlaying) return;
		const intervalId = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(intervalId);
	}, [isPlaying]);

	const counter = remainingSeconds(gameState, now);

	// Re-arm the payout when a *new* round starts. Resuming from a pause is not
	// a new round, hence the previous-status check. Still a boolean rather than
	// a remembered round number: `updateGameSettings` ("relancer la partie")
	// puts `round` back to 0, which a remembered number would match forever.
	useEffect(() => {
		const previousStatus = prevStatus.current;
		prevStatus.current = gameStatus;

		if (gameStatus !== GameStatus.Playing) return;
		if (previousStatus === GameStatus.Paused) return;

		roundFinalizedRef.current = false;
	}, [gameStatus]);

	// Every client watches the clock, but only the host ends the round: scoring
	// reads and rewrites the whole players array, so letting each browser do it
	// would race the others into clobbering scores. The rest just sit at 0 and
	// wait for the realtime update.
	useEffect(() => {
		if (!code || !isPlaying || !isHostPlayer) return;
		if (counter > 0) return;

		finalizeRound(code);
	}, [code, isPlaying, isHostPlayer, counter, finalizeRound]);

	// Pops on the host's screen each time one more player has answered. The
	// single element is reused: the sound is short and this is the app's only
	// effect.
	const popRef = useRef<HTMLAudioElement | null>(null);
	const answeredCountRef = useRef<number | null>(null);

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
