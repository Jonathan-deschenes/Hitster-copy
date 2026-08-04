const CODE_LENGTH = 4;
const CODE_CHARS = "0123456789";

export function getRandomCode(length = CODE_LENGTH, chars = CODE_CHARS) {
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}
