import { playerDisplayName } from "../../util";
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
	/**
	 * One line per player instead of a stacked card, for the places where
	 * height is the scarce dimension and width the free one: above the album
	 * art on mobile, and under an expanded settings panel on desktop.
	 */
	compact?: boolean;
}

export default function LobbyPlayerAnswerBox({
	pseudo,
	points,
	correct = false,
	toneIndex = 0,
	isYou = false,
	host = false,
	answer,
	compact = false,
}: LobbyPlayerAnswerBoxProps) {
	const surface = correct
		? "border-emerald-400/40 bg-emerald-400/[0.08]"
		: "border-lavender/14 bg-lavender/3";

	const pointsBadge = correct
		? "bg-emerald-400/16 text-emerald-300"
		: "bg-lavender/8 text-lavender/44";

	if (compact) {
		return (
			<div
				className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${surface}`}
			>
				<PlayerAvatar
					pseudo={pseudo}
					toneIndex={toneIndex}
					size='xs'
					isYou={isYou}
					showLabel={false}
				/>

				<span className='max-w-[5.5rem] shrink-0 truncate text-xs font-medium'>
					{playerDisplayName(pseudo, isYou)}
				</span>

				<span
					className={`min-w-0 flex-1 truncate text-right text-xs ${answer ? "" : "text-lavender/44 italic"}`}
					title={answer || undefined}
				>
					{answer ? answer : "Aucune réponse"}
				</span>

				<span
					className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold ${pointsBadge}`}
				>
					+{points}
				</span>
			</div>
		);
	}

	return (
		<div
			className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${surface}`}
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
				className={`shrink-0 rounded-full px-2.5 py-1 text-[0.78rem] font-bold ${pointsBadge}`}
			>
				+{points}
			</span>
		</div>
	);
}
