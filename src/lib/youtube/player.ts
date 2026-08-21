declare global {
	interface Window {
		YT: typeof YT;
		onYouTubeIframeAPIReady?: () => void;
	}
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
const PLAYER_IFRAME_TITLE = "Good luck!";

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
 * Mounts a YT.Player into a container appended to <body>. No visual is needed —
 * the cover art in AlbumArtPanel already comes from Spotify's metadata — but the
 * player must still be a *real, rendered* size: YouTube throttles or outright
 * refuses playback (and can report error 150, "impossible de lire ici") in a
 * player it deems non-viewable. So it's a full-size element moved off-screen by
 * position, **not** hidden with `display:none`/`opacity:0` or shrunk to a couple
 * of pixels — those all read as "not visible" to YouTube's checks.
 *
 * `origin` is passed explicitly: without it, YouTube can't validate the
 * embedding page and rejects *every* video with a 150/101, independent of which
 * video it is — the most common cause of "no track ever plays."
 */
export function createYoutubePlayer(events: YT.Events): YT.Player {
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.top = "0";
	container.style.left = "-9999px";
	container.style.width = "320px";
	container.style.height = "180px";
	container.style.pointerEvents = "none";
	document.body.appendChild(container);

	const playerHolder: { current?: YT.Player } = {};
	let observedIframe: HTMLIFrameElement | null = null;
	const titleObserver = new MutationObserver(() => protectIframeTitle());

	/**
	 * YouTube writes the video's real name into the host-page iframe's `title`
	 * attribute after every load. Keep a useful generic accessibility label
	 * instead, so the answer is not printed directly in Elements.
	 */
	function protectIframeTitle() {
		const iframe = playerHolder.current?.getIframe();
		if (!iframe) return;

		if (observedIframe !== iframe) {
			titleObserver.disconnect();
			observedIframe = iframe;
			titleObserver.observe(iframe, {
				attributes: true,
				attributeFilter: ["title"],
			});
		}

		if (iframe.title !== PLAYER_IFRAME_TITLE) {
			iframe.title = PLAYER_IFRAME_TITLE;
		}
	}

	// The API replaces `container` with its iframe. Watch that one replacement,
	// then `protectIframeTitle` narrows the observer to the iframe's title only.
	titleObserver.observe(document.body, { childList: true, subtree: true });

	const player = new window.YT.Player(container, {
		height: "180",
		width: "320",
		playerVars: {
			autoplay: 0,
			controls: 0,
			disablekb: 1,
			fs: 0,
			modestbranding: 1,
			playsinline: 1,
			origin: window.location.origin,
		},
		events: {
			...events,
			onReady: (event) => {
				protectIframeTitle();
				events.onReady?.(event);
			},
		},
	});
	playerHolder.current = player;

	const destroy = player.destroy.bind(player);
	player.destroy = () => {
		titleObserver.disconnect();
		observedIframe = null;
		playerHolder.current = undefined;
		destroy();
	};

	return player;
}
