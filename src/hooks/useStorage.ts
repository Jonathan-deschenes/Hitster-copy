const StorageKeys = {
	USER_NAME: "USER_NAME",
	SPOTIFY_HOST_AUTH: "SPOTIFY_HOST_AUTH",
	SPOTIFY_HOST_VOLUME: "SPOTIFY_HOST_VOLUME",
} as const;

export type StorageKeysType = (typeof StorageKeys)[keyof typeof StorageKeys];

class StorageUtility {
	static setItem<T>(key: StorageKeysType, value: T): void {
		try {
			const jsonValue = JSON.stringify(value);
			localStorage.setItem(key, jsonValue);
		} catch {
			/* localStorage unavailable */
		}
	}

	static getItem<T>(key: StorageKeysType): T | null {
		try {
			const jsonValue = localStorage.getItem(key);
			const value = jsonValue != null ? JSON.parse(jsonValue) : null;
			return value;
		} catch {
			return null;
		}
	}

	static removeItem(key: StorageKeysType): void {
		try {
			localStorage.removeItem(key);
		} catch {
			/* localStorage unavailable */
		}
	}

	static clear(): void {
		try {
			localStorage.clear();
		} catch {
			/* localStorage unavailable */
		}
	}

	static getMultipleItems(
		keys: Array<StorageKeysType>,
	): Record<StorageKeysType, unknown> | undefined {
		try {
			const result: [string, string | null][] = keys.map((key) => [
				key,
				localStorage.getItem(key),
			]);
			return result.reduce(
				(pre, [key, raw]) => ({
					...pre,
					[key]: raw ? JSON.parse(raw) : null,
				}),
				{} as Record<StorageKeysType, unknown>,
			);
		} catch {
			return undefined;
		}
	}
}

export { StorageUtility, StorageKeys };
