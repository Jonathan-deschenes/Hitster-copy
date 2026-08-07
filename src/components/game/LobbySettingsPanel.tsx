import type { lobbyProps } from "../../types";
import { IconSettings } from "../icons/GameIcons";
import LobbySettings from "./LobbySettings";

interface LobbySettingsPanelProps {
	lobby: lobbyProps;
	className?: string;
}

export default function LobbySettingsPanel({
	lobby,
	className = "",
}: LobbySettingsPanelProps) {
	return (
		<div
			className={`flex h-full w-full max-w-md flex-col rounded-3xl border border-lavender/14 bg-lavender/5 p-5 backdrop-blur-lg ${className}`}
		>
			<div className='mb-4 flex shrink-0 items-center gap-2'>
				<IconSettings />
				<h2 className='font-display text-lg font-bold'>Paramètres</h2>
			</div>
			<div className='min-h-0 flex-1 overflow-y-auto'>
				<LobbySettings lobby={lobby} />
			</div>
		</div>
	);
}
