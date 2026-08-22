import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GameStatus } from "../types";
import type { GameStateEnum, lobbyProps } from "../types";
import {
	finishRound,
	heartbeatLobbySession,
	kickPlayer,
	leaveLobby,
	pauseRound,
	promotePlayer,
	resumeRound,
	startRound,
	updateGameSettings,
	updateGameStatus,
	updatePlayerAnswer,
} from "../lib/lobbies";
import { isFinalRound } from "../util";
import {
	clearLobbySessionToken,
	markLobbySessionDisconnecting,
} from "../lib/lobbies/session";
import type { youtubePlayerHandleProps } from "./useYoutubePlayer";

interface UseGameActionsParams {
	code?: string;
	lobby: lobbyProps | null;
	currentPlayerId?: string | null;
	sessionToken: string | null;
	/** Owned by the page — see the single call site in `pages/Game.tsx`. */
	youtubePlayer: youtubePlayerHandleProps;
}

export function useGameActions({
	code,
	lobby,
	currentPlayerId,
	sessionToken,
	youtubePlayer,
}: UseGameActionsParams) {
	const navigate = useNavigate();

	const currentPlayer = lobby?.player.find((p) => p.id === currentPlayerId);

	// The database owns expiry and host transfer. This tab only renews its own
	// unguessable lease; it never decides that another player should be removed.
	useEffect(() => {
		if (!code || !currentPlayerId || !sessionToken) return;

		const renew = () => {
			heartbeatLobbySession(code, currentPlayerId, sessionToken)
				.then((active) => {
					if (active) return;
					clearLobbySessionToken(code, currentPlayerId);
					navigate("/", { replace: true });
				})
				.catch(console.error);
		};
		const handlePageHide = () => {
			markLobbySessionDisconnecting(code, currentPlayerId, sessionToken);
		};

		renew();
		const heartbeat = window.setInterval(renew, 10_000);
		window.addEventListener("pagehide", handlePageHide);

		return () => {
			window.clearInterval(heartbeat);
			window.removeEventListener("pagehide", handlePageHide);
		};
	}, [code, currentPlayerId, navigate, sessionToken]);

	async function handleLeaving() {
		if (!code || !lobby || !currentPlayerId || !sessionToken) return;

		if (currentPlayer?.host) await youtubePlayer.pause();
		await leaveLobby(code, currentPlayerId, sessionToken);
		clearLobbySessionToken(code, currentPlayerId);

		navigate("/");
	}

	async function handlePlayerKick(playerId: string) {
		if (!code || !lobby || !playerId || !currentPlayerId || !sessionToken)
			return;

		if (currentPlayer?.host)
			await kickPlayer(code, currentPlayerId, sessionToken, playerId);
	}

	async function handlePlayerPromotion(playerId: string) {
		if (!code || !lobby || !playerId || !currentPlayerId || !sessionToken)
			return;

		if (currentPlayer?.host && playerId !== currentPlayer?.id)
			await promotePlayer(code, currentPlayerId, sessionToken, playerId);
	}

	// Starting the first round and starting every later one are the same
	// operation, and both are a single atomic write: answers, question, round,
	// status, clock and track index land together. See `startRound`.
	async function handleStartGame() {
		if (!code) return;
		await startRound(code);
	}

	async function handleNewRound() {
		if (!code) return;
		await startRound(code);
	}

	/** The last round has been revealed — move everyone to the final standings. */
	async function handleEndGame() {
		if (!code) return;
		await updateGameStatus(code, GameStatus.Ended);
	}

	async function handlePauseGame() {
		if (!code) return;
		await pauseRound(code);
	}

	async function handleResumeGame() {
		if (!code) return;
		await resumeRound(code);
	}

	// There is no round after the last one — the queue holds exactly
	// `totalRounds` items and `startRound` would just replay the final track.
	const finalRound = isFinalRound(
		lobby?.game_state,
		lobby?.music_queue?.length,
	);

	const hostActionByStatus: Record<GameStateEnum, () => void> = {
		[GameStatus.Waiting]: handleStartGame,
		[GameStatus.Playing]: handlePauseGame,
		[GameStatus.Paused]: handleResumeGame,
		[GameStatus.Finished]: finalRound ? handleEndGame : handleNewRound,
		[GameStatus.Ended]: handleRestartGame,
	};

	async function handlePlayerAnswer(answer: string, playerId: string) {
		if (!code || !answer || !playerId) return;

		await updatePlayerAnswer(code, answer, playerId);
	}

	/** Ends the round early, revealing and scoring the track as it stands. */
	async function handleSkipTrack() {
		if (!code || !lobby) return;

		await finishRound(code);
	}

	/** "Relancer la partie": same settings, scores and round counter back to 0. */
	async function handleRestartGame() {
		if (!code || !lobby) return;

		await updateGameSettings(code, {
			mode: lobby.game_state.mode,
			rounds: lobby.game_state.totalRounds,
			category: lobby.category,
			public: lobby.public,
			duration: lobby.game_state.duration,
		});
	}

	return {
		currentPlayer,
		finalRound,
		handleLeaving,
		handlePlayerKick,
		handlePlayerPromotion,
		handlePlayerAnswer,
		handleSkipTrack,
		handleRestartGame,
		hostActionByStatus,
	};
}
