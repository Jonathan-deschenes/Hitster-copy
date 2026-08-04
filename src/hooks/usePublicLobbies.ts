import { useEffect, useState } from "react";
import type { lobbyRowProps } from "../types";
import { findPublicLobbies, subscribeToPublicLobbies } from "../lib/lobbies";

export function usePublicLobbies() {
	const [publicLobbies, setPublicLobbies] = useState<lobbyRowProps[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		findPublicLobbies()
			.then(setPublicLobbies)
			.finally(() => setLoading(false));

		const unsubscribe = subscribeToPublicLobbies(setPublicLobbies);

		return unsubscribe;
	}, []);

	return { publicLobbies, loading };
}
