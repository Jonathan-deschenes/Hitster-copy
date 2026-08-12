import type { playerProps } from "../../types";
import PlayerAvatar from "./PlayerAvatar";
import { rankPlayers } from "../../util";

interface PlayerAvatarListProps {
	players: playerProps[];
	currentPlayerId?: string | null;
}

export default function PlayerAvatarList({
	players,
	currentPlayerId,
}: PlayerAvatarListProps) {
	return (
		<ul className='glass-panel flex max-w-full justify-center gap-6 overflow-x-auto px-6 py-4'>
			{rankPlayers(players).map(({ player, rank, toneIndex }) => (
				<li
					key={player.id}
					className='relative flex w-17 shrink-0 flex-col items-center gap-[0.45rem]'
				>
					<PlayerAvatar
						pseudo={player.pseudo}
						toneIndex={toneIndex}
						size='md'
						isYou={player.id === currentPlayerId}
						host={player.host}
						rank={rank}
						hasAnswered={!!player.answer}
					/>
					<span className='text-[0.72rem] font-bold text-accent-blue'>
						{player.score ?? 0} pts
					</span>
				</li>
			))}
		</ul>
	);
}
