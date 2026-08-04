import { useMemo } from "react";
import {
	Navigate,
	useLocation,
	useParams,
	useSearchParams,
} from "react-router-dom";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import type { lobbyProps } from "../types";
import { PrimaryButton } from "../components/Button";
import { useLobbyRealtime } from "../hooks/useLobbyRealtime";
import { useGameActions } from "../hooks/useGameActions";
import LobbyHeaderBadges from "../components/game/LobbyHeaderBadges";
import AlbumArtPanel from "../components/game/AlbumArtPanel";
import ScoreboardPanel from "../components/game/ScoreboardPanel";
import GameStatusBadge from "../components/game/GameStatusBadge";
import HostActionButton from "../components/game/HostActionButton";
import PlayerAvatarList from "../components/game/PlayerAvatarList";

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

	// current game state
	const gameState = lobby?.game_state;

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

			<main className='relative z-10 md:grid md:grid-cols-[1fr_auto_1fr] flex flex-col-reverse justify-center items-center w-full gap-8 px-6 pt-6 pb-4 sm:px-10 lg:flex-row lg:items-start lg:justify-center lg:px-16'>
				<div></div>
				<AlbumArtPanel />
				<ScoreboardPanel players={scoredPlayers} currentPlayerId={current} />
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

					{gameState && currentPlayer?.host && (
						<HostActionButton
							status={gameState.status}
							onClick={hostActionByStatus[gameState.status]}
						/>
					)}

					<PlayerAvatarList players={lobby.player} currentPlayerId={current} />
				</div>
			</footer>
		</PageBackground>
	);
}
