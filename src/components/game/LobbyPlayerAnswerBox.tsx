import PlayerAvatar from "./PlayerAvatar";

interface LobbyPlayerAnswerBoxProps {
	pseudo: string;
	/** Points won this round — not the running total. */
	points: number;
	correct?: boolean;
	toneIndex?: number;
	isYou?: boolean;
	host?: boolean;
	answer: string;
}

export default function LobbyPlayerAnswerBox({
	pseudo,
	points,
	correct = false,
	toneIndex = 0,
	isYou = false,
	host = false,
	answer,
}: LobbyPlayerAnswerBoxProps) {
	return (
		<div
			className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
				correct
					? "border-emerald-400/40 bg-emerald-400/[0.08]"
					: "border-lavender/14 bg-lavender/3"
			}`}
		>
			<PlayerAvatar
				pseudo={pseudo}
				toneIndex={toneIndex}
				size='sm'
				isYou={isYou}
				host={host}
			/>

			<h3
				className={`min-w-0 truncate ${answer ? "" : "text-lavender/44 italic"}`}
				title={answer || undefined}
			>
				{answer ? answer : "Aucune réponse"}
			</h3>

			<span
				className={`shrink-0 rounded-full px-2.5 py-1 text-[0.78rem] font-bold ${
					correct
						? "bg-emerald-400/16 text-emerald-300"
						: "bg-lavender/8 text-lavender/44"
				}`}
			>
				+{points}
			</span>
		</div>
	);
}
