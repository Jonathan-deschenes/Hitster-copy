declare global {
	interface Window {
		YT: typeof YT;
		onYouTubeIframeAPIReady?: () => void;
	}
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

let iframeApiPromise: Promise<void> | null = null;

/** Injects the YouTube IFrame API script once and resolves once YT.Player is constructible. */
export function loadYoutubeIframeApi(): Promise<void> {
	if (window.YT?.Player) return Promise.resolve();

	if (!iframeApiPromise) {
		iframeApiPromise = new Promise<void>((resolve) => {
			window.onYouTubeIframeAPIReady = resolve;

			if (!document.querySelector(`script[src="${IFRAME_API_SRC}"]`)) {
				const script = document.createElement("script");
				script.src = IFRAME_API_SRC;
				document.head.appendChild(script);
			}
		});
	}

	return iframeApiPromise;
}

// Numeric codes match YT.PlayerError (2/5/100/101/150), kept as literals: the
// ambient `YT` namespace is a type only, and reading its enum as a *value*
// here would need `window.YT` to already exist — it's injected by the
// iframe_api script, which hasn't loaded yet when this module is evaluated.
const ERROR_MESSAGES: Record<number, string> = {
	2: "Vidéo YouTube invalide.",
	5: "Erreur de lecture YouTube.",
	100: "Vidéo YouTube introuvable.",
	101: "Cette vidéo ne peut pas être lue ici.",
	150: "Cette vidéo ne peut pas être lue ici.",
};

export function describeYoutubeError(code: YT.PlayerError): string {
	return ERROR_MESSAGES[code] ?? "Erreur de lecture YouTube.";
}

/**
 * Mounts a YT.Player into a near-zero, off-screen container appended to
 * <body> — not `display:none`, since it's producing audio, not decoration.
 * No visual is needed: the cover art in AlbumArtPanel already comes from
 * Spotify's metadata.
 */
export function createYoutubePlayer(events: YT.Events): YT.Player {
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.bottom = "0";
	container.style.right = "0";
	container.style.width = "2px";
	container.style.height = "2px";
	container.style.opacity = "0";
	container.style.pointerEvents = "none";
	document.body.appendChild(container);

	return new window.YT.Player(container, {
		height: "2",
		width: "2",
		playerVars: {
			autoplay: 0,
			controls: 0,
			disablekb: 1,
			fs: 0,
			modestbranding: 1,
			playsinline: 1,
		},
		events,
	});
}
