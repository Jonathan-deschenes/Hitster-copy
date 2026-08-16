import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GameStatus } from "../types";
import type { GameStateEnum, lobbyProps, playerProps } from "../types";
import {
	deleteLobby,
	finishRound,
	leaveLobby,
	pauseRound,
	promotePlayer,
	resumeRound,
	startRound,
	subscribeToLobbyPresence,
	updateGameSettings,
	updateGameStatus,
	updatePlayerAnswer,
} from "../lib/lobbies";
import {
	isFinalRound,
	pickRandomOtherPlayer,
	pickSuccessorPlayer,
} from "../util";
import type { youtubePlayerHandleProps } from "./useYoutubePlayer";

interface UseGameActionsParams {
	code?: string;
	lobby: lobbyProps | null;
	currentPlayerId?: string | null;
	/** Owned by the page — see the single call site in `pages/Game.tsx`. */
	youtubePlayer: youtubePlayerHandleProps;
}

/** Promotes `successor` and removes the departing player, or deletes the lobby if no one is left to hand it to. */
async function resolveHostDeparture(
	code: string,
	departingPlayerId: string,
	successor: playerProps | null,
) {
	if (successor) {
		await promotePlayer(code, successor.id);
		await leaveLobby(code, departingPlayerId);
	} else {
		await deleteLobby(code);
	}
}

export function useGameActions({
	code,
	lobby,
	currentPlayerId,
	youtubePlayer,
}: UseGameActionsParams) {
	const navigate = useNavigate();

	const currentPlayer = lobby?.player.find((p) => p.id === currentPlayerId);
	const players = lobby?.player;

	// Kept fresh without re-subscribing the presence channel on every lobby update.
	const playersRef = useRef(players);
	useEffect(() => {
		playersRef.current = players;
	}, [players]);

	// Detects players (including the host) whose connection drops without
	// going through handleLeaving/handlePlayerKick (closed tab, crash, lost
	// network, ...). Each connected client runs this same logic and, thanks
	// to the deterministic successor pick, only one of them actually acts.
	useEffect(() => {
		if (!code || !currentPlayerId) return;

		const unsubscribe = subscribeToLobbyPresence(
			code,
			currentPlayerId,
			(leftPlayerId) => {
				const currentPlayers = playersRef.current;
				if (!currentPlayers) return;

				const leftPlayer = currentPlayers.find((p) => p.id === leftPlayerId);
				// Already handled through a normal leave/kick, or unknown player.
				if (!leftPlayer) return;

				if (leftPlayer.host) {
					const successor = pickSuccessorPlayer(currentPlayers, leftPlayerId);
					// Nobody else in the lobby to detect this at all, or it's not my turn to act.
					if (!successor || successor.id !== currentPlayerId) return;

					resolveHostDeparture(code, leftPlayerId, successor);
				} else {
					// Only the host is allowed to remove a player.
					const iAmHost = currentPlayers.find(
						(p) => p.id === currentPlayerId,
					)?.host;
					if (!iAmHost) return;

					leaveLobby(code, leftPlayerId);
				}
			},
		);

		return unsubscribe;
	}, [code, currentPlayerId]);

	async function handleLeaving() {
		if (!code || !lobby || !currentPlayerId || !players) return;

		if (currentPlayer?.host) {
			const successor = pickRandomOtherPlayer(players, currentPlayerId);
			await youtubePlayer.pause();
			await resolveHostDeparture(code, currentPlayerId, successor);
		} else {
			await leaveLobby(code, currentPlayerId);
		}

		navigate("/");
	}

	async function handlePlayerKick(playerId: string) {
		if (!code || !lobby || !playerId) return;

		if (currentPlayer?.host) await leaveLobby(code, playerId);
	}

	async function handlePlayerPromotion(playerId: string) {
		if (!code || !lobby || !playerId) return;

		if (currentPlayer?.host && playerId !== currentPlayer?.id)
			await promotePlayer(code, playerId);
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
		lobby?.music_queue?.items.length,
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

		const { items = [], current = 0 } = lobby.music_queue ?? {};
		await finishRound(code, items[current]);
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
