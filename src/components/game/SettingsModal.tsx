import Modal, { ModalBody, ModalHeader } from "../Modal";
import LobbySettings from "./LobbySettings";
import type { lobbyProps } from "../../types";

interface SettingsModalProps {
	open: boolean;
	onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
	lobby: lobbyProps;
}

/** Mobile counterpart of the desktop `LobbySettingsPanel`. */
export default function SettingsModal({
	open,
	onOpenChange,
	lobby,
}: SettingsModalProps) {
	const close = () => onOpenChange(false);

	return (
		<Modal
			open={open}
			onClose={close}
			labelledBy='lobby-settings-title'
			size='md'
		>
			<ModalHeader
				id='lobby-settings-title'
				title='Paramètres de la partie'
				onClose={close}
			/>
			<ModalBody>
				<LobbySettings
					lobby={lobby}
					mobileMenuClose={onOpenChange}
					desktopMenuClose={onOpenChange}
				/>
			</ModalBody>
		</Modal>
	);
}
