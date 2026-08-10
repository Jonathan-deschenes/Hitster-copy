import { IconCrown, IconUser } from "../icons/PlayerIcons";
import { RANK_STYLES } from "./rankStyles";

// Picked by index rather than by id so a player keeps the same colour
// wherever they're rendered. Callers should pass the player's position in
// the *unsorted* list, otherwise the colours shuffle as the scores move.
const tones = [
	"bg-linear-to-br from-purple-light to-purple",
	"bg-linear-to-br from-accent-blue to-purple",
	"bg-linear-to-br from-purple-soft to-[#d63bff]",
	"bg-linear-to-br from-[#47bfff] to-[#2f8fff]",
];

const sizes = {
	sm: "h-10 w-10",
	md: "h-12 w-12",
};

// Caps the label so a long pseudo truncates instead of stretching the row.
const labelWidths = {
	sm: "w-16",
	md: "w-17",
};

interface PlayerAvatarProps {
	/** Name shown under the icon. */
	pseudo: string;
	/** Position of the player in the unsorted list — selects the gradient. */
	toneIndex?: number;
	size?: keyof typeof sizes;
	/** Highlights the avatar and appends "(toi)" to the name. */
	isYou?: boolean;
	/** Adds the crown badge. */
	host?: boolean;
	/** Adds the medal badge for ranks 1 to 3; ignored otherwise. */
	rank?: number;
	className?: string;
}

export default function PlayerAvatar({
	pseudo,
	toneIndex = 0,
	size = "md",
	isYou = false,
	host = false,
	rank,
	className = "",
}: PlayerAvatarProps) {
	const rankStyle = rank ? RANK_STYLES[rank] : undefined;

	return (
		<span
			className={`flex shrink-0 flex-col items-center gap-[0.45rem] ${className}`}
		>
			<span
				className={`relative flex items-center justify-center rounded-full border-2 text-white ${sizes[size]} ${tones[toneIndex % tones.length]} ${
					isYou
						? "border-accent-blue shadow-[0_0_0_3px_rgba(71,191,255,0.25)]"
						: "border-white/16"
				}`}
			>
				<IconUser />
				{host && (
					<span className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-lavender/14 bg-bg-deep text-accent-blue'>
						<IconCrown />
					</span>
				)}
				{rankStyle && (
					<span
						className={`absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-bg-deep text-[0.65rem] font-bold ${rankStyle}`}
					>
						{rank}
					</span>
				)}
			</span>

			<span
				className={`truncate text-center text-[0.78rem] text-lavender/68 ${labelWidths[size]}`}
			>
				{pseudo || "Anonyme"}
				{isYou && " (toi)"}
			</span>
		</span>
	);
}
