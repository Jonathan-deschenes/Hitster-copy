import type { gameStateProps, playerProps } from "../../types";
import { PrimaryButton } from "../Button";
import { IconRefresh } from "../icons/GameIcons";
import { IconCrown } from "../icons/PlayerIcons";
import PodiumPlace from "./PodiumPlace";
import { playerDisplayName, rankPlayers } from "../../util";

interface PodiumStageProps {
	players: playerProps[];
	currentPlayerId: string;
	gameState?: gameStateProps;
	/** Playlist the game was played on, shown under the title. */
	categoryLabel?: string;
	/** Host flag alone: restarting writes settings, it isn't playback. */
	isHostPlayer: boolean;
	onNewGame: () => void;
}

/**
 * Final standings. Replaces `GameStage` while `game_state.status` is `ended`,
 * which only the host writes — every client lands here together.
 */
export default function PodiumStage({
	players,
	currentPlayerId,
	gameState,
	categoryLabel,
	isHostPlayer,
	onNewGame,
}: PodiumStageProps) {
	// `rankPlayers` keeps each player's index in the *unsorted* list as
	// `toneIndex`, so avatars hold the colour they had all game.
	const ranked = rankPlayers(players);
	const podium = ranked.slice(0, 3);
	const rest = ranked.slice(3);
	const winner = podium[0]?.player;

	// 2nd · 1st · 3rd, filtered so a two-player game doesn't leave a hole.
	const podiumOrder = [podium[1], podium[0], podium[2]].filter(
		(entry) => !!entry,
	);

	return (
		<main className='relative z-10 flex w-full flex-1 flex-col items-center px-4 py-2 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:px-12'>
			<div className='my-auto flex w-full max-w-2xl flex-col items-center gap-6 py-4'>
				<header className='flex flex-col items-center gap-2 text-center'>
					<h1 className='bg-linear-to-br from-lavender via-purple-soft to-accent-blue bg-clip-text font-display text-3xl font-bold text-transparent sm:text-4xl'>
						Partie terminée
					</h1>
					{gameState && (
						<p className='text-sm text-lavender/68'>
							{gameState.totalRounds} manches
							{categoryLabel ? ` · ${categoryLabel}` : ""}
						</p>
					)}
					{winner && (
						<p className='mt-1 flex items-center gap-2 rounded-full border border-[#ffd76a]/40 bg-[#ffd76a]/10 px-4 py-1.5 text-[0.9rem] font-semibold text-[#ffd76a]'>
							<IconCrown />
							{playerDisplayName(
								winner.pseudo,
								winner.id === currentPlayerId,
							)}{" "}
							remporte la partie !
						</p>
					)}
				</header>

				<ol className='flex w-full max-w-lg items-end justify-center gap-2 sm:gap-4'>
					{podiumOrder.map(({ player, rank, toneIndex }) => (
						<PodiumPlace
							key={player.id}
							player={player}
							rank={rank}
							toneIndex={toneIndex}
							isYou={player.id === currentPlayerId}
						/>
					))}
				</ol>

				{rest.length > 0 && (
					<div className='flex w-full max-w-md flex-col glass-panel'>
						<h2 className='mb-3 font-display text-[0.95rem] font-bold text-lavender/80'>
							Autres joueurs
						</h2>
						<ol className='flex max-h-40 flex-col gap-2 overflow-y-auto pr-1'>
							{rest.map(({ player, rank }) => {
								const isYou = player.id === currentPlayerId;

								return (
									<li
										key={player.id}
										className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${
											isYou
												? "border-accent-blue bg-purple/12"
												: "border-lavender/14 bg-lavender/3"
										}`}
									>
										<span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavender/10 text-[0.8rem] font-bold text-lavender/68'>
											{rank}
										</span>
										<span className='flex min-w-0 flex-1 items-center gap-1.5 truncate text-[0.9rem] font-medium'>
											<span className='truncate'>
												{playerDisplayName(player.pseudo, isYou)}
											</span>
											{player.host && (
												<span className='shrink-0 text-accent-blue'>
													<IconCrown />
												</span>
											)}
										</span>
										<span className='shrink-0 text-[0.95rem] font-bold text-accent-blue'>
											{player.score ?? 0} pts
										</span>
									</li>
								);
							})}
						</ol>
					</div>
				)}

				{isHostPlayer ? (
					<PrimaryButton
						type='button'
						className='w-full max-w-xs active:scale-[0.98]'
						onClick={onNewGame}
					>
						<IconRefresh />
						Nouvelle partie
					</PrimaryButton>
				) : (
					<p className='text-center text-sm text-lavender/60'>
						En attente de l'hôte pour relancer une partie…
					</p>
				)}
			</div>
		</main>
	);
}
