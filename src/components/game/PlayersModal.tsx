import Modal, { ModalBody, ModalHeader } from "../Modal";
import Scoreboard from "./Scoreboard";
import type { playerProps } from "../../types";

interface PlayersModalProps {
	open: boolean;
	onClose: () => void;
	players: playerProps[];
	currentPlayerId?: string;
	canManagePlayers: boolean;
	kickAction: (playerId: string) => void;
	promotionAction: (playerId: string) => void;
}

/** Mobile counterpart of the desktop `ScoreboardPanel`. */
export default function PlayersModal({
	open,
	onClose,
	players,
	currentPlayerId,
	canManagePlayers,
	kickAction,
	promotionAction,
}: PlayersModalProps) {
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy='manage-players-title'
			size='md'
		>
			<ModalHeader
				id='manage-players-title'
				title={canManagePlayers ? "Gérer les joueurs" : "Classement"}
				onClose={onClose}
			/>
			<ModalBody>
				<Scoreboard
					players={players}
					currentPlayerId={currentPlayerId}
					canManagePlayers={canManagePlayers}
					kickAction={kickAction}
					promotionAction={promotionAction}
				/>
			</ModalBody>
		</Modal>
	);
}
