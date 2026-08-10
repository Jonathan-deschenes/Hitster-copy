import type { playerProps } from "../../types";
import LobbyPlayerAnswerBox from "./LobbyPlayerAnswerBox";

interface LobbyAnswerBoxProps {
	className?: string;
	players: playerProps[];
}

export default function LobbyAnswerBox({
	className = "",
	players,
}: LobbyAnswerBoxProps) {
	return (
		<div
			className={`flex w-full max-w-md flex-col rounded-3xl border border-lavender/14 bg-lavender/5 p-5 backdrop-blur-lg ${className}`}
		>
			<div className='mb-4 flex shrink-0 items-center gap-2'>
				<h2 className='font-display text-lg font-bold'>
					Résultat de la manche
				</h2>
			</div>
			<div className=' space-y-4'>
				{players.map((player, index) => (
					<LobbyPlayerAnswerBox
						key={player.id}
						pseudo={player.pseudo}
						points={player.score}
						toneIndex={index}
						host={player.host}
						answer={player.answer}
					/>
				))}
			</div>
		</div>
	);
}
