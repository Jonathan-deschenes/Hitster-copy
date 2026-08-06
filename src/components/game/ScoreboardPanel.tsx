import type { playerProps } from "../../types";
import { IconTrophy } from "../icons/GameIcons";
import Scoreboard from "./Scoreboard";

interface ScoreboardPanelProps {
	players: playerProps[];
	currentPlayerId?: string | null;
	canManagePlayers?: boolean;
	kickAction: (playerId: string) => void;
	promotionAction: (playerId: string) => void;
	className?: string;
}

export default function ScoreboardPanel({
	players,
	currentPlayerId,
	canManagePlayers,
	kickAction,
	promotionAction,
	className = "",
}: ScoreboardPanelProps) {
	return (
		<div
			className={`flex h-full w-full max-w-sm flex-col rounded-3xl border border-lavender/14 bg-lavender/5 p-5 backdrop-blur-lg ${className}`}
		>
			<div className='mb-4 flex shrink-0 items-center gap-2'>
				<IconTrophy />
				<h2 className='font-display text-lg font-bold'>Classement</h2>
			</div>
			<div className='min-h-0 flex-1'>
				<Scoreboard
					players={players}
					currentPlayerId={currentPlayerId}
					canManagePlayers={canManagePlayers}
					kickAction={kickAction}
					promotionAction={promotionAction}
				/>
			</div>
		</div>
	);
}
