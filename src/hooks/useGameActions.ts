import { useNavigate } from "react-router-dom";
import { GameStatus } from "../types";
import type { GameStateEnum, lobbyProps } from "../types";
import {
	deleteLobby,
	leaveLobby,
	updateGameStatus,
	updateRound,
} from "../lib/lobbies";
import { promotePlayer } from "../lib/lobbies/lobbyMutations";

interface UseGameActionsParams {
	code?: string;
	lobby: lobbyProps | null;
	currentPlayerId?: string | null;
}

export function useGameActions({
	code,
	lobby,
	currentPlayerId,
}: UseGameActionsParams) {
	const navigate = useNavigate();

	const currentPlayer = lobby?.player.find((p) => p.id === currentPlayerId);
	const gameState = lobby?.game_state;

	async function handleLeaving() {
		if (!code || !lobby || !currentPlayerId) return;

		if (currentPlayer?.host) {
			await deleteLobby(code);
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
