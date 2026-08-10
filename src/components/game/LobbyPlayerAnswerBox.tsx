import PlayerAvatar from "./PlayerAvatar";

interface LobbyPlayerAnswerBoxProps {
	pseudo: string;
	points: number;
	toneIndex?: number;
	isYou?: boolean;
	host?: boolean;
	answer: string;
}

export default function LobbyPlayerAnswerBox({
	pseudo,
	points,
	toneIndex = 0,
	isYou = false,
	host = false,
	answer,
}: LobbyPlayerAnswerBoxProps) {
	return (
		<div className='flex items-center justify-between gap-3 rounded-2xl border border-lavender/14 bg-lavender/3 px-4 py-3'>
			<PlayerAvatar
				pseudo={pseudo}
				toneIndex={toneIndex}
				size='sm'
				isYou={isYou}
				host={host}
			/>

			<h3>{answer ? answer : "Aucun réponse"}</h3>

			<span className='shrink-0 rounded-full bg-accent-blue/14 px-2.5 py-1 text-[0.78rem] font-bold text-accent-blue'>
				+{points}
			</span>
		</div>
	);
}
