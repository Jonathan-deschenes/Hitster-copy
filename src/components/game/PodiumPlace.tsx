import type { playerProps } from "../../types";
import { IconTrophy } from "../icons/GameIcons";
import PlayerAvatar from "./PlayerAvatar";
import { RANK_STYLES } from "./rankStyles";

// Only the three medal places get a pedestal; everyone else is listed below it.
const PEDESTAL_HEIGHTS: Record<number, string> = {
	1: "h-24 sm:h-32",
	2: "h-16 sm:h-24",
	3: "h-12 sm:h-20",
};

// The winner rises last, so the eye lands on them.
const RISE_DELAYS: Record<number, string> = {
	1: "[animation-delay:220ms]",
	2: "[animation-delay:110ms]",
	3: "[animation-delay:0ms]",
};

interface PodiumPlaceProps {
	player: playerProps;
	/** 1, 2 or 3 — drives the medal colour and the pedestal height. */
	rank: number;
	/** Position in the *unsorted* list, so the avatar keeps its colour. */
	toneIndex: number;
	isYou: boolean;
}

export default function PodiumPlace({
	player,
	rank,
	toneIndex,
	isYou,
}: PodiumPlaceProps) {
	const isWinner = rank === 1;

	return (
		<li
			className={`flex min-w-0 max-w-[10rem] flex-1 basis-0 flex-col items-center justify-end gap-2 motion-safe:animate-podium-rise ${RISE_DELAYS[rank] ?? ""}`}
		>
			{/* Kept in the layout for 2nd and 3rd so the three columns stay aligned. */}
			<span
				aria-hidden='true'
				className={`text-[#ffd76a] ${isWinner ? "" : "invisible"}`}
			>
				<IconTrophy />
			</span>

			<PlayerAvatar
				pseudo={player.pseudo}
				toneIndex={toneIndex}
				size='md'
				isYou={isYou}
				host={player.host}
				rank={rank}
				glow={isWinner}
			/>

			<span className='text-[0.85rem] font-bold text-accent-blue'>
				{player.score ?? 0} pts
			</span>

			<div
				className={`flex w-full items-center justify-center rounded-t-2xl border-t border-white/25 font-display text-2xl font-bold sm:text-3xl ${PEDESTAL_HEIGHTS[rank] ?? PEDESTAL_HEIGHTS[3]} ${RANK_STYLES[rank] ?? "bg-lavender/10 text-lavender/68"}`}
			>
				{rank}
			</div>
		</li>
	);
}
