import type { ReactNode } from "react";
import { GameStatus } from "../../types";
import type { GameStateEnum } from "../../types";
import { PrimaryButton, SecondaryButton } from "../Button";
import {
	IconNextRound,
	IconPause,
	IconPlay,
	IconRefresh,
	IconTrophy,
} from "../icons/GameIcons";

type hostActionMetaProps = {
	label: string;
	icon: ReactNode;
	variant: "primary" | "secondary";
};

// Host-only action button: what it does next, matched to a play/pause/next icon.
const HOST_ACTION_META: Record<GameStateEnum, hostActionMetaProps> = {
	[GameStatus.Waiting]: {
		label: "Commencer la partie",
		icon: <IconPlay />,
		variant: "primary",
	},
	[GameStatus.Playing]: {
		label: "Mettre en pause",
		icon: <IconPause />,
		variant: "secondary",
	},
	[GameStatus.Paused]: {
		label: "Reprendre la partie",
		icon: <IconPlay />,
		variant: "primary",
	},
	[GameStatus.Finished]: {
		label: "Manche suivante",
		icon: <IconNextRound />,
		variant: "primary",
	},
	[GameStatus.Ended]: {
		label: "Nouvelle partie",
		icon: <IconRefresh />,
		variant: "primary",
	},
};

// Replaces the `Finished` entry on the last round: there is no next manche,
// only the final standings.
const FINAL_ROUND_ACTION: hostActionMetaProps = {
	label: "Voir le classement final",
	icon: <IconTrophy />,
	variant: "primary",
};

interface HostActionButtonProps {
	status: GameStateEnum;
	/** The revealed round was the game's last one. */
	isFinalRound?: boolean;
	onClick: () => void;
}

export default function HostActionButton({
	status,
	isFinalRound = false,
	onClick,
}: HostActionButtonProps) {
	const hostAction =
		isFinalRound && status === GameStatus.Finished
			? FINAL_ROUND_ACTION
			: HOST_ACTION_META[status];
	const ButtonComponent =
		hostAction.variant === "secondary" ? SecondaryButton : PrimaryButton;

	return (
		<ButtonComponent
			type='submit'
			className='w-fit active:scale-[0.98]'
			onClick={onClick}
		>
			{hostAction.icon}
			{hostAction.label}
		</ButtonComponent>
	);
}
