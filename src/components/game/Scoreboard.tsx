import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { playerProps } from "../../types";
import { IconCrown, IconKick, IconMore } from "../icons/PlayerIcons";
import { RANK_STYLES } from "./rankStyles";
import { playerDisplayName, rankPlayers } from "../../util";

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
	const [menuPosition, setMenuPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const menuButtonRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!menuPlayerId) return;

		function updateMenuPosition() {
			const button = menuButtonRef.current;
			if (!button) return;

			const rect = button.getBoundingClientRect();
			const menuWidth = 160;
			const menuHeight = menuRef.current?.offsetHeight ?? 88;
			const gap = 4;
			const viewportPadding = 8;
			const fitsBelow =
				rect.bottom + gap + menuHeight <= window.innerHeight - viewportPadding;

			setMenuPosition({
				top: fitsBelow
					? rect.bottom + gap
					: Math.max(viewportPadding, rect.top - menuHeight - gap),
				left: Math.max(
					viewportPadding,
					Math.min(
						rect.right - menuWidth,
						window.innerWidth - menuWidth - viewportPadding,
					),
				),
			});
		}

		function handleClickOutside(event: PointerEvent) {
			const target = event.target as Node;
			if (
				!menuButtonRef.current?.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				setMenuPlayerId(null);
			}
		}

		updateMenuPosition();
		document.addEventListener("pointerdown", handleClickOutside);
		window.addEventListener("resize", updateMenuPosition);
		window.addEventListener("scroll", updateMenuPosition, true);

		return () => {
			document.removeEventListener("pointerdown", handleClickOutside);
			window.removeEventListener("resize", updateMenuPosition);
			window.removeEventListener("scroll", updateMenuPosition, true);
			setMenuPosition(null);
		};
	}, [menuPlayerId]);

	const modalRoot = document.getElementById("modal-root");

	return (
		<ol className='scrollbar-hidden flex h-full flex-col gap-2 overflow-y-auto pr-1'>
			{rankPlayers(players).map(({ player, rank }) => {
				const isYou = player.id === currentPlayerId;
				const isManageable = canManagePlayers && !isYou;
				const isMenuOpen = menuPlayerId === player.id;

				return (
					<li
						key={player.id}
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
								{playerDisplayName(player.pseudo, isYou)}
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
								ref={isMenuOpen ? menuButtonRef : null}
								type='button'
								aria-label={`Gérer ${player.pseudo || "ce joueur"}`}
								aria-haspopup='menu'
								aria-expanded={isMenuOpen}
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

						{isMenuOpen &&
							menuPosition &&
							modalRoot &&
							createPortal(
								<div
									ref={menuRef}
									role='menu'
									className='fixed z-[70] flex w-40 flex-col overflow-hidden rounded-xl border border-lavender/14 bg-bg-deep shadow-lg'
									style={menuPosition}
								>
								<button
									type='button'
									role='menuitem'
									onClick={() => {
										promotionAction(player.id);
										setMenuPlayerId(null);
									}}
									className='flex items-center gap-2 px-3 py-2.5 text-left text-[0.82rem] text-lavender/85 transition-colors hover:bg-lavender/10'
								>
									<IconCrown />
									Promouvoir hôte
								</button>
								<button
									type='button'
									role='menuitem'
									onClick={() => {
										kickAction(player.id);
										setMenuPlayerId(null);
									}}
									className='flex items-center gap-2 px-3 py-2.5 text-left text-[0.82rem] text-red-400 transition-colors hover:bg-red-500/10'
								>
									<IconKick />
									Exclure
								</button>
								</div>,
								modalRoot,
							)}
					</li>
				);
			})}
		</ol>
	);
}
