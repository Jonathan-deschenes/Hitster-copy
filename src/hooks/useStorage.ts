const StorageKeys = {
	USER_NAME: "USER_NAME",
	YOUTUBE_VOLUME: "YOUTUBE_VOLUME",
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

}

export { StorageUtility, StorageKeys };
