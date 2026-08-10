import type { playerProps } from "../../types";
import PlayerAvatar from "./PlayerAvatar";

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
						<PlayerAvatar
							pseudo={player.pseudo}
							toneIndex={originalIndex}
							size='md'
							isYou={isYou}
							host={player.host}
							rank={rank}
						/>
						<span className='text-[0.72rem] font-bold text-accent-blue'>
							{player.score ?? 0} pts
						</span>
					</li>
				);
			})}
		</ul>
	);
}
