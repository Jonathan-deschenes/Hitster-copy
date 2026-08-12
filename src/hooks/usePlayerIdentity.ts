import { useState, type ChangeEvent } from "react";
import generateUniqueId from "generate-unique-id";
import type { playerProps } from "../types";
import { StorageKeys, StorageUtility } from "./useStorage";

/**
 * The local player both entry forms build. The pseudo persists to
 * localStorage as it is typed, so it is pre-filled next time.
 */
export function usePlayerIdentity(host: boolean) {
	const [player, setPlayer] = useState<playerProps>(() => ({
		id: generateUniqueId(),
		pseudo: StorageUtility.getItem<string>(StorageKeys.USER_NAME) ?? "",
		host,
		score: 0,
		answer: "",
	}));

	function handlePseudoName(event: ChangeEvent<HTMLInputElement>) {
		const pseudo = event.target.value;
		setPlayer((prev) => ({ ...prev, pseudo }));
		StorageUtility.setItem(StorageKeys.USER_NAME, pseudo);
	}

	return { player, setPlayer, handlePseudoName };
}
