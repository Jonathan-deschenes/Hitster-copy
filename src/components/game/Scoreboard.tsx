import { useEffect, useRef, useState } from "react";
import type { playerProps } from "../../types";
import { IconCrown, IconKick, IconMore } from "../icons/PlayerIcons";

const RANK_STYLES: Record<number, string> = {
	1: "bg-linear-to-br from-[#ffd76a] to-[#ff9f1c] text-bg-deep",
	2: "bg-linear-to-br from-[#e6e6e6] to-[#aeaeae] text-bg-deep",
	3: "bg-linear-to-br from-[#e3a06a] to-[#a8663a] text-bg-deep",
};

interface ScoreboardProps {
	players: playerProps[];
	currentPlayerId?: string | null;
	canManagePlayers?: boolean;
	kickAction: (playerId: string) => void;
	promotionAction: (playerId: string) => void;
}

export default function Scoreboard({
	players,
	currentPlayerId,
	canManagePlayers = false,
	kickAction,
	promotionAction,
}: ScoreboardProps) {
	const [menuPlayerId, setMenuPlayerId] = useState<string | null>(null);
	const openMenuRef = useRef<HTMLLIElement | null>(null);

	useEffect(() => {
		if (!menuPlayerId) return;

		function handleClickOutside(e: MouseEvent) {
			if (
				openMenuRef.current &&
				!openMenuRef.current.contains(e.target as Node)
			) {
				setMenuPlayerId(null);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [menuPlayerId]);

	const ranked = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

	return (
		<ol className='flex flex-col gap-2'>
			{ranked.map((player, index) => {
				const rank = index + 1;
				const isYou = player.id === currentPlayerId;
				const isManageable = canManagePlayers && !isYou;
				const isMenuOpen = menuPlayerId === player.id;

				return (
					<li
						key={player.id}
						ref={isMenuOpen ? openMenuRef : undefined}
						className={`relative flex items-center gap-4 rounded-2xl border px-4 py-3 ${
							isYou
								? "border-accent-blue bg-purple/12"
								: "border-lavender/14 bg-lavender/3"
						}`}
					>
						<span
							className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
								RANK_STYLES[rank] ?? "bg-lavender/10 text-lavender/68"
							}`}
						>
							{rank}
						</span>

						<span className='flex min-w-0 flex-1 items-center gap-1.5 truncate text-[0.95rem] font-medium'>
							<span className='truncate'>
								{player.pseudo || "Anonyme"}
								{isYou && " (toi)"}
							</span>
							{player.host && (
								<span className='shrink-0 text-accent-blue'>
									<IconCrown />
								</span>
							)}
						</span>

						<span className='shrink-0 text-[1.05rem] font-bold text-accent-blue'>
							{player.score ?? 0} pts
						</span>

						{isManageable && (
							<button
								type='button'
								aria-label={`Gérer ${player.pseudo || "ce joueur"}`}
								onClick={() =>
									setMenuPlayerId((current) =>
										current === player.id ? null : player.id,
									)
								}
								className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lavender/50 transition-colors hover:bg-lavender/10 hover:text-lavender'
							>
								<IconMore />
							</button>
						)}

						{isMenuOpen && (
							<div className='absolute top-full right-4 z-40 mt-1 flex w-40 flex-col overflow-hidden rounded-xl border border-lavender/14 bg-bg-deep shadow-lg'>
								<button
									type='button'
									onClick={() => promotionAction(player.id)}
									className='flex items-center gap-2 px-3 py-2.5 text-left text-[0.82rem] text-lavender/85 transition-colors hover:bg-lavender/10'
								>
									<IconCrown />
									Promouvoir hôte
								</button>
								<button
									type='button'
									onClick={() => kickAction(player.id)}
									className='flex items-center gap-2 px-3 py-2.5 text-left text-[0.82rem] text-red-400 transition-colors hover:bg-red-500/10'
								>
									<IconKick />
									Exclure
								</button>
							</div>
						)}
					</li>
				);
			})}
		</ol>
	);
}
