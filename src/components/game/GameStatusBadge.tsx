import type { ReactNode } from "react";
import { GameStatus } from "../../types";
import type { gameStateProps, GameStateEnum } from "../../types";
import { IconClock, IconPause, IconTrophy } from "../icons/GameIcons";

// Player-facing status badge: icon + label + visual tone shown to every player.
const STATUS_META: Record<
	GameStateEnum,
	{ label: string; icon: ReactNode; badgeClass: string }
> = {
	[GameStatus.Waiting]: {
		label: "En attente de l'hôte…",
		icon: <IconClock />,
		badgeClass: "border-lavender/14 bg-lavender/5 text-lavender/68",
	},
	[GameStatus.Playing]: {
		label: "Écoutez attentivement",
		icon: (
			<span className='h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-blue shadow-[0_0_8px_2px_rgba(71,191,255,0.65)]' />
		),
		badgeClass: "border-accent-blue/40 bg-accent-blue/10 text-accent-blue",
	},
	[GameStatus.Paused]: {
		label: "Partie en pause",
		icon: <IconPause />,
		badgeClass: "border-[#ff9f1c]/40 bg-[#ff9f1c]/10 text-[#ffb84d]",
	},
	[GameStatus.Finished]: {
		label: "Manche terminée",
		icon: <IconTrophy />,
		badgeClass: "border-purple-soft/50 bg-purple/15 text-purple-soft",
	},
	[GameStatus.Ended]: {
		label: "Partie terminée",
		icon: <IconTrophy />,
		badgeClass: "border-[#ffd76a]/45 bg-[#ffd76a]/10 text-[#ffd76a]",
	},
};

interface GameStatusBadgeProps {
	gameState: gameStateProps;
}

export default function GameStatusBadge({ gameState }: GameStatusBadgeProps) {
	const statusMeta = STATUS_META[gameState.status];

	return (
		<div className='flex flex-col items-center gap-2'>
			<span
				className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[0.85rem] font-semibold ${statusMeta.badgeClass}`}
			>
				{statusMeta.icon}
				{statusMeta.label}
			</span>
			<span className='text-[0.75rem] text-lavender/44'>
				Manche {gameState.round + 1} / {gameState.totalRounds}
			</span>
		</div>
	);
}
