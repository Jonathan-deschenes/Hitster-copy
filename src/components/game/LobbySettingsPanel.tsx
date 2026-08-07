import { useState } from "react";
import type { SetStateAction } from "react";
import type { lobbyProps } from "../../types";
import { IconPlus, IconSettings } from "../icons/GameIcons";
import LobbySettings from "./LobbySettings";

interface LobbySettingsPanelProps {
	lobby: lobbyProps;
	className?: string;
	mobileMenuClose: React.Dispatch<SetStateAction<boolean>>;
}

export default function LobbySettingsPanel({
	lobby,
	className = "",
	mobileMenuClose,
}: LobbySettingsPanelProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div
			className={`flex w-full max-w-md flex-col rounded-3xl border border-lavender/14 bg-lavender/5 p-5 backdrop-blur-lg ${isOpen ? "min-h-0 flex-1" : "h-fit shrink-0"} ${className}`}
		>
			<button
				type='button'
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				className={`flex shrink-0 items-center justify-between gap-2 ${isOpen ? "mb-4" : ""}`}
			>
				<span className='flex items-center gap-2'>
					<IconSettings />
					<h2 className='font-display text-lg font-bold'>Paramètres</h2>
				</span>
				<span
					className={`flex h-6 w-6 items-center justify-center rounded-full bg-lavender/10 text-lavender/85 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
				>
					<IconPlus />
				</span>
			</button>
			{isOpen && (
				<div className='min-h-0 flex-1 overflow-y-auto'>
					<LobbySettings
						lobby={lobby}
						mobileMenuClose={mobileMenuClose}
						desktopMenuClose={setIsOpen}
					/>
				</div>
			)}
		</div>
	);
}
