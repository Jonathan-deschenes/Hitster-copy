import { IconCheck, IconCrown, IconUser } from "../icons/PlayerIcons";
import { RANK_STYLES } from "./rankStyles";
import { playerDisplayName } from "../../util";

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
	xs: "h-7 w-7",
	sm: "h-10 w-10",
	md: "h-12 w-12",
};

// Caps the label so a long pseudo truncates instead of stretching the row.
const labelWidths = {
	xs: "w-12",
	sm: "w-16",
	md: "w-17",
};

/**
 * The "you" ring and the winner glow are both box-shadows, so their
 * combination is spelled out rather than stacked: two `shadow-[…]` utilities on
 * one element resolve by emitted-CSS order, not by the order they're written.
 */
function highlightClasses(isYou: boolean, glow: boolean) {
	if (isYou && glow)
		return "border-accent-blue shadow-[0_0_0_3px_rgba(71,191,255,0.25),0_0_26px_-2px_rgba(255,215,106,0.75)]";
	if (isYou)
		return "border-accent-blue shadow-[0_0_0_3px_rgba(71,191,255,0.25)]";
	if (glow)
		return "border-[#ffd76a]/70 shadow-[0_0_26px_-2px_rgba(255,215,106,0.75)]";
	return "border-white/16";
}

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
	/** Adds the check badge once the player submitted an answer this round. */
	hasAnswered?: boolean;
	/**
	 * Golden halo for the game's winner. Sits on the circle itself — wrapping
	 * the whole component instead would centre the glow on the avatar *and* its
	 * label, leaving it visibly low.
	 */
	glow?: boolean;
	/** Off for inline rows that print the pseudo themselves. */
	showLabel?: boolean;
	className?: string;
}

export default function PlayerAvatar({
	pseudo,
	toneIndex = 0,
	size = "md",
	isYou = false,
	host = false,
	rank,
	hasAnswered = false,
	glow = false,
	showLabel = true,
	className = "",
}: PlayerAvatarProps) {
	const rankStyle = rank ? RANK_STYLES[rank] : undefined;

	return (
		<span
			className={`flex shrink-0 flex-col items-center gap-[0.45rem] ${className}`}
		>
			<span
				className={`relative flex items-center justify-center rounded-full border-2 text-white ${sizes[size]} ${tones[toneIndex % tones.length]} ${highlightClasses(isYou, glow)}`}
			>
				<IconUser />
				{host && (
					<span className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-lavender/14 bg-bg-deep text-accent-blue'>
						<IconCrown />
					</span>
				)}
				{hasAnswered && (
					<span
						className='absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-lavender/14 bg-bg-deep text-emerald-300'
						title='A répondu'
					>
						<IconCheck />
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

			{showLabel && (
				<span
					className={`truncate text-center text-[0.78rem] text-lavender/68 ${labelWidths[size]}`}
				>
					{playerDisplayName(pseudo, isYou)}
				</span>
			)}
		</span>
	);
}
