import type { playerProps } from "../../types";
import { IconTrophy } from "../icons/GameIcons";
import Scoreboard from "../Scoreboard";

interface ScoreboardPanelProps {
	players: playerProps[];
	currentPlayerId?: string | null;
	canManagePlayers?: boolean;
	kickAction: (playerId: string) => void;
	promotionAction: (playerId: string) => void;
}

export default function ScoreboardPanel({
	players,
	currentPlayerId,
	canManagePlayers,
	kickAction,
	promotionAction,
}: ScoreboardPanelProps) {
	return (
		<div className='md:justify-self-end w-full max-w-sm rounded-3xl border border-lavender/14 bg-lavender/5 p-5 backdrop-blur-lg'>
			<div className='mb-4 flex items-center gap-2'>
				<IconTrophy />
				<h2 className='font-display text-lg font-bold'>Classement</h2>
			</div>
			<Scoreboard
				players={players}
				currentPlayerId={currentPlayerId}
				canManagePlayers={canManagePlayers}
				kickAction={kickAction}
				promotionAction={promotionAction}
			/>
		</div>
	);
}
