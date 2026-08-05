const VERIFIER_CHARSET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function base64UrlEncode(buffer: ArrayBuffer): string {
	const binary = String.fromCharCode(...new Uint8Array(buffer));
	return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function generateRandomString(length: number): string {
	const values = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(values, (v) => VERIFIER_CHARSET[v % VERIFIER_CHARSET.length]).join("");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
	const data = new TextEncoder().encode(verifier);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return base64UrlEncode(digest);
}
