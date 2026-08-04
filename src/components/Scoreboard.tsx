import type { playerProps } from "../types";
import { IconCrown } from "./icons/PlayerIcons";

const RANK_STYLES: Record<number, string> = {
	1: "bg-linear-to-br from-[#ffd76a] to-[#ff9f1c] text-bg-deep",
	2: "bg-linear-to-br from-[#e6e6e6] to-[#aeaeae] text-bg-deep",
	3: "bg-linear-to-br from-[#e3a06a] to-[#a8663a] text-bg-deep",
};

interface ScoreboardProps {
	players: playerProps[];
	currentPlayerId?: string | null;
}

export default function Scoreboard({
	players,
	currentPlayerId,
}: ScoreboardProps) {
	const ranked = [...players].sort(
		(a, b) => (b.score ?? 0) - (a.score ?? 0),
	);

	return (
		<ol className="flex flex-col gap-2">
			{ranked.map((player, index) => {
				const rank = index + 1;
				const isYou = player.id === currentPlayerId;

				return (
					<li
						key={player.id}
						className={`flex items-center gap-4 rounded-2xl border px-4 py-3 ${
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

						<span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[0.95rem] font-medium">
							<span className="truncate">
								{player.pseudo || "Anonyme"}
								{isYou && " (toi)"}
							</span>
							{player.host && (
								<span className="shrink-0 text-accent-blue">
									<IconCrown />
								</span>
							)}
						</span>

						<span className="shrink-0 text-[1.05rem] font-bold text-accent-blue">
							{player.score ?? 0} pts
						</span>
					</li>
				);
			})}
		</ol>
	);
}
