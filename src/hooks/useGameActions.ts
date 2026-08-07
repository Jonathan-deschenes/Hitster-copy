import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GameStatus } from "../types";
import type { GameStateEnum, lobbyProps, playerProps } from "../types";
import {
	deleteLobby,
	leaveLobby,
	subscribeToLobbyPresence,
	updateGameStatus,
	updateRound,
} from "../lib/lobbies";
import { promotePlayer } from "../lib/lobbies/lobbyMutations";
import { pickRandomOtherPlayer, pickSuccessorPlayer } from "../util";
import { useSpotifyPlayer } from "./useSpotifyPlayer";

interface UseGameActionsParams {
	code?: string;
	lobby: lobbyProps | null;
	currentPlayerId?: string | null;
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
}: UseGameActionsParams) {
	const navigate = useNavigate();

	const currentPlayer = lobby?.player.find((p) => p.id === currentPlayerId);
	const players = lobby?.player;
	const gameState = lobby?.game_state;

	// Deliberately not scoped to `currentPlayer?.host`: any Spotify-connected
	// player pre-warming a device while they're just a regular player is what
	// lets a later promotion resume instantly instead of racing Spotify's
	// "device not yet controllable" window right at handoff time.
	const spotifyPlayer = useSpotifyPlayer({ enabled: true });

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
			await spotifyPlayer.pause();
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

	async function handleStartGame() {
		if (!code) return;
		await updateGameStatus(code, GameStatus.Playing);
	}

	async function handlePauseGame() {
		if (!code) return;
		await updateGameStatus(code, GameStatus.Paused);
	}

	async function handleResumeGame() {
		if (!code) return;
		await updateGameStatus(code, GameStatus.Playing);
	}

	async function handleNewRound() {
		if (!code || !gameState) return;
		await updateRound(code, gameState.round + 1);
		await updateGameStatus(code, GameStatus.Playing);
	}

	const hostActionByStatus: Record<GameStateEnum, () => void> = {
		[GameStatus.Waiting]: handleStartGame,
		[GameStatus.Playing]: handlePauseGame,
		[GameStatus.Paused]: handleResumeGame,
		[GameStatus.Finished]: handleNewRound,
	};

	return {
		currentPlayer,
		handleLeaving,
		handlePlayerKick,
		handlePlayerPromotion,
		hostActionByStatus,
	};
}
