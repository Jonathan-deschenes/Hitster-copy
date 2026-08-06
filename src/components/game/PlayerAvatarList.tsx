import type { playerProps } from "../../types";
import { IconCrown, IconUser } from "../icons/PlayerIcons";
import { RANK_STYLES } from "./rankStyles";

const tones = [
	"bg-linear-to-br from-purple-light to-purple",
	"bg-linear-to-br from-accent-blue to-purple",
	"bg-linear-to-br from-purple-soft to-[#d63bff]",
	"bg-linear-to-br from-[#47bfff] to-[#2f8fff]",
];

interface PlayerAvatarListProps {
	players: playerProps[];
	currentPlayerId?: string | null;
}

export default function PlayerAvatarList({
	players,
	currentPlayerId,
}: PlayerAvatarListProps) {
	const ranked = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

	return (
		<ul className='flex max-w-full justify-center gap-6 overflow-x-auto rounded-3xl border border-lavender/14 bg-lavender/5 px-6 py-4 backdrop-blur-lg'>
			{ranked.map((player, index) => {
				const rank = index + 1;
				const isYou = player.id === currentPlayerId;
				const originalIndex = players.findIndex((p) => p.id === player.id);

				return (
					<li
						key={player.id}
						className='relative flex w-17 shrink-0 flex-col items-center gap-[0.45rem]'
					>
						<span
							className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-white ${tones[originalIndex % tones.length]} ${
								isYou
									? "border-accent-blue shadow-[0_0_0_3px_rgba(71,191,255,0.25)]"
									: "border-white/16"
							}`}
						>
							<IconUser />
							{player.host && (
								<span className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-lavender/14 bg-bg-deep text-accent-blue'>
									<IconCrown />
								</span>
							)}
							{RANK_STYLES[rank] && (
								<span
									className={`absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-bg-deep text-[0.65rem] font-bold ${RANK_STYLES[rank]}`}
								>
									{rank}
								</span>
							)}
						</span>
						<span className='w-17 truncate text-center text-[0.78rem] text-lavender/68'>
							{player.pseudo || "Anonyme"}
							{isYou && " (toi)"}
						</span>
						<span className='text-[0.72rem] font-bold text-accent-blue'>
							{player.score ?? 0} pts
						</span>
					</li>
				);
			})}
		</ul>
	);
}
