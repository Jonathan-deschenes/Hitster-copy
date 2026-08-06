import type { ReactNode } from "react";
import { GameStatus } from "../../types";
import type { GameStateEnum } from "../../types";
import { PrimaryButton, SecondaryButton } from "../Button";
import { IconNextRound, IconPause, IconPlay } from "../icons/GameIcons";

// Host-only action button: what it does next, matched to a play/pause/next icon.
const HOST_ACTION_META: Record<
	GameStateEnum,
	{ label: string; icon: ReactNode; variant: "primary" | "secondary" }
> = {
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
};

interface HostActionButtonProps {
	status: GameStateEnum;
	onClick: () => void;
}

export default function HostActionButton({
	status,
	onClick,
}: HostActionButtonProps) {
	const hostAction = HOST_ACTION_META[status];
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
