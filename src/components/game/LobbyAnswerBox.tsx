import type { GameModeEnum, musicItemsProps, playerProps } from "../../types";
import { expectedAnswer } from "../../lib/scoring";
import LobbyPlayerAnswerBox from "./LobbyPlayerAnswerBox";

interface LobbyAnswerBoxProps {
	className?: string;
	players: playerProps[];
	currentTrack?: musicItemsProps;
	questionMode: GameModeEnum;
	currentPlayerId?: string;
}

export default function LobbyAnswerBox({
	className = "",
	players,
	currentTrack,
	questionMode,
	currentPlayerId,
}: LobbyAnswerBoxProps) {
	// Comes from the same per-mode switch the scorer uses, so what players are
	// shown is exactly what they were graded against.
	const answer = expectedAnswer(currentTrack, questionMode);

	return (
		<div
			className={`flex w-full max-w-md flex-col glass-panel ${className}`}
		>
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
			<div className=' space-y-4'>
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
					/>
				))}
			</div>
		</div>
	);
}
