import { useEffect, useRef, useState } from "react";
import type { lobbyProps, playerProps } from "../types";
import { getLobbyByCode, subscribeToLobbyByCode } from "../lib/lobbies";
import { showToast } from "../lib/toast";

export function useLobbyRealtime(
	code: string | undefined,
	currentPlayerId: string | null,
	initialLobby: lobbyProps | null,
) {
	const hadInitialLobbyRef = useRef(initialLobby != null);
	const [lobby, setLobby] = useState<lobbyProps | null>(() => initialLobby);
	const previousPlayersRef = useRef<playerProps[]>(initialLobby?.player ?? []);
	const [kicked, setKicked] = useState<boolean>(false);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!code) return;

		let cancelled = false;

		getLobbyByCode(code).then((found) => {
			if (cancelled) return;
			if (found) {
				previousPlayersRef.current = found.player;
				setLobby(found);
			} else if (!hadInitialLobbyRef.current) {
				setNotFound(true);
			}
		});

		const unsubscribe = subscribeToLobbyByCode(
			code,
			(updated) => {
				if (cancelled) return;

				const previousIds = new Set(
					previousPlayersRef.current.map((player) => player.id),
				);
				const nextIds = new Set(updated.player.map((player) => player.id));

				// handle kicked player
				const wasKicked =
					currentPlayerId != null &&
					previousIds.has(currentPlayerId) &&
					!nextIds.has(currentPlayerId);

				if (wasKicked) {
					showToast("Vous avez été exclu du lobby.", "closed");
					setKicked(true);
				}

				// handle player promotion
				const previousHost = previousPlayersRef.current.find((p) => p.host);
				const newHost = updated.player.find((p) => p.host);

				console.log("[promotion debug]", {
					previousHostId: previousHost?.id,
					newHostId: newHost?.id,
					previousPlayers: previousPlayersRef.current,
					updatedPlayers: updated.player,
				});

				if (previousHost?.id !== newHost?.id) {
					showToast(
						`${newHost?.pseudo || "Un joueur"} a été promu hôte de la partie.`,
						"join",
					);
				}

				for (const player of updated.player) {
					if (!previousIds.has(player.id) && player.id !== currentPlayerId) {
						showToast(
							`${player.pseudo || "Un joueur"} a rejoint la partie`,
							"join",
						);
					}
				}

				for (const player of previousPlayersRef.current) {
					if (!nextIds.has(player.id) && player.id !== currentPlayerId) {
						showToast(
							`${player.pseudo || "Un joueur"} a quitté la partie`,
							"leave",
						);
					}
				}

				previousPlayersRef.current = updated.player;
				setLobby(updated);
			},
			() => {
				// The lobby was deleted (e.g. the host left) while we were in it.
				if (!cancelled) {
					showToast("L'hôte a fermé le lobby.", "closed");
					setNotFound(true);
				}
			},
		);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [code, currentPlayerId]);

	return { lobby, notFound, kicked };
}
