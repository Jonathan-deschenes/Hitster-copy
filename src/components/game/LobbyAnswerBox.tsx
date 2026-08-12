import type { GameModeEnum, musicItemsProps, playerProps } from "../../types";
import { expectedAnswer } from "../../lib/scoring";
import LobbyPlayerAnswerBox from "./LobbyPlayerAnswerBox";

interface LobbyAnswerBoxProps {
	className?: string;
	players: playerProps[];
	currentTrack?: musicItemsProps;
	questionMode: GameModeEnum;
	currentPlayerId?: string;
	/** Tighter spacing, and the list scrolls instead of growing. */
	compact?: boolean;
}

export default function LobbyAnswerBox({
	className = "",
	players,
	currentTrack,
	questionMode,
	currentPlayerId,
	compact = false,
}: LobbyAnswerBoxProps) {
	// Comes from the same per-mode switch the scorer uses, so what players are
	// shown is exactly what they were graded against.
	const answer = expectedAnswer(currentTrack, questionMode);

	return (
		<div
			className={`flex w-full max-w-md flex-col glass-panel ${compact ? "p-3!" : ""} ${className}`}
		>
			{/* Compact puts the title and the answer on one line — on mobile the
			    box has to leave room for the album art underneath. */}
			{compact ? (
				<div className='mb-2 flex shrink-0 items-baseline gap-2'>
					<h2 className='shrink-0 font-display text-sm font-bold'>Résultat</h2>
					{answer && (
						<p
							className='min-w-0 flex-1 truncate text-right text-xs text-lavender/68'
							title={answer}
						>
							Réponse : <span className='text-lavender'>{answer}</span>
						</p>
					)}
				</div>
			) : (
				<div className='mb-4 flex shrink-0 flex-col gap-1'>
					<h2 className='font-display text-lg font-bold'>
						Résultat de la manche
					</h2>
					{answer && (
						<p className='truncate text-sm text-lavender/68' title={answer}>
							Réponse : <span className='text-lavender'>{answer}</span>
						</p>
					)}
				</div>
			)}
			<div
				className={
					compact
						? "max-h-[26dvh] space-y-1.5 overflow-y-auto pr-1"
						: "space-y-4"
				}
			>
				{players.map((player, index) => (
					<LobbyPlayerAnswerBox
						key={player.id}
						pseudo={player.pseudo}
						points={player.roundPoints ?? 0}
						correct={player.roundCorrect ?? false}
						toneIndex={index}
						isYou={player.id === currentPlayerId}
						host={player.host}
						answer={player.answer}
						compact={compact}
					/>
				))}
			</div>
		</div>
	);
}
