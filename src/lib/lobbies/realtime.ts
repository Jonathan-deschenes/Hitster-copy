import { supabase } from "../supabaseClient";
import type { lobbyProps, lobbyRowProps } from "../../types";
import { rowToLobby } from "./mappers";
import { findPublicLobbies } from "./queries";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function subscribeToPublicLobbies(
	onChange: (lobbies: lobbyRowProps[]) => void,
) {
	const refresh = () => {
		findPublicLobbies().then(onChange).catch(console.error);
	};

	// No `is_public` filter here: Realtime's postgres_changes filter is
	// evaluated against the NEW row on UPDATE, so a public->private toggle
	// (new row has is_public=false) would never match `is_public=eq.true`
	// and the change would never reach this callback. Instead we listen to
	// every change on the table and let `findPublicLobbies()` (called by
	// `refresh`) do the actual is_public filtering server-side.
	const channel = supabase
		.channel("public-lobbies")
		.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "lobbies",
			},
			refresh,
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}

export function subscribeToLobbyByCode(
	code: string,
	onUpdate: (lobby: lobbyProps) => void,
	onDelete?: () => void,
) {
	const channel = supabase
		.channel(`lobby-${code}`)
		.on(
			"postgres_changes",
			{
				event: "UPDATE",
				schema: "public",
				table: "lobbies",
				filter: `code=eq.${code}`,
			},
			(payload) => {
				onUpdate(rowToLobby(payload.new as lobbyRowProps));
			},
		)
		.on(
			"postgres_changes",
			{
				event: "DELETE",
				schema: "public",
				table: "lobbies",
				filter: `code=eq.${code}`,
			},
			() => {
				onDelete?.();
			},
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}

// A page refresh closes the websocket and reopens a new one a moment later,
// which looks identical to a real disconnect from the presence channel's
// point of view. Holding the leave for this long before acting on it gives
// the reload time to reconnect and re-track under the same key. The reload
// has to redo the whole pipeline from scratch — reload the JS bundle,
// reconnect the websocket, rejoin the presence channel, `track()` again —
// which routinely runs past a couple of seconds (worse in dev, where the
// bundle isn't pre-built), so this is deliberately generous.
const PRESENCE_LEAVE_GRACE_MS = 5000;

// How often each client re-stamps its own presence entry, and how often
// every client scans for others who've gone stale. Only runs while the tab
// is foregrounded (see `document.visibilityState` check below) — a
// suspended/backgrounded tab naturally stops restamping, which is exactly
// the signal the staleness scan below is looking for.
const HEARTBEAT_INTERVAL_MS = 4000;

// No heartbeat for this long ⇒ treat as gone. This is the backstop for
// mobile swipe-away / lock-screen / backgrounding Safari — none of those
// reliably fire a `leave` event (the OS can suspend JS and leave the socket
// in limbo rather than closing it), so we can't wait for one; we just
// notice the timestamp went stale. Keep this comfortably above
// HEARTBEAT_INTERVAL_MS so normal jitter never trips it.
const STALE_THRESHOLD_MS = 20000;

function isKeyPresent(channel: RealtimeChannel, key: string): boolean {
	const metas = channel.presenceState()[key];
	return Array.isArray(metas) && metas.length > 0;
}

/**
 * Tracks the current player's presence on a per-lobby channel and reports
 * when another tracked player disconnects — whether that's a clean socket
 * close (tab closed, crash, network loss — caught via the `leave` event) or
 * a mobile suspend that never sends one (swipe-away, lock screen,
 * backgrounding — caught via the heartbeat staleness scan below).
 */
export function subscribeToLobbyPresence(
	code: string,
	playerId: string,
	onPlayerLeave: (playerId: string) => void,
): () => void {
	const channel = supabase.channel(`presence-lobby-${code}`, {
		config: { presence: { key: playerId } },
	});

	// Leaves are held here until the grace period elapses; a `join` with the
	// same key (the reconnect after a refresh) cancels the pending one.
	const pendingLeaves = new Map<string, ReturnType<typeof setTimeout>>();

	function armGracefulLeave(key: string) {
		// A reload's reconnect can be observed by the server *before* it
		// notices the old connection is gone — `join` then arrives ahead of
		// the `leave` that describes the connection it replaced. Phoenix
		// presence keeps one meta entry per underlying connection under a
		// key, so if the key is still present here, some connection for it
		// is already back and this `leave` is stale: ignore it outright
		// instead of arming a timer nothing will ever cancel.
		if (isKeyPresent(channel, key)) return;

		const existing = pendingLeaves.get(key);
		if (existing) clearTimeout(existing);

		pendingLeaves.set(
			key,
			setTimeout(() => {
				pendingLeaves.delete(key);
				// Re-check again at fire time in case the reconnect landed
				// after this timer was armed but wasn't caught by the `join`
				// listener below for some reason.
				if (isKeyPresent(channel, key)) return;
				onPlayerLeave(key);
			}, PRESENCE_LEAVE_GRACE_MS),
		);
	}

	function cancelPendingLeave(key: string) {
		const pending = pendingLeaves.get(key);
		if (pending) {
			clearTimeout(pending);
			pendingLeaves.delete(key);
		}
	}

	channel
		// Fast path: a clean desktop close/refresh fires this and is handled
		// via the reload-safe grace period above.
		.on("presence", { event: "leave" }, ({ key }) => armGracefulLeave(key))
		.on("presence", { event: "join" }, ({ key }) => cancelPendingLeave(key))
		.subscribe((status) => {
			if (status === "SUBSCRIBED") {
				channel.track({ online_at: Date.now() });
			}
		});

	// Heartbeat: only restamps while this tab is actually foregrounded.
	// Swiping away, locking the screen, or backgrounding Safari all stop
	// this from running — that's the detection signal, not a side effect.
	const heartbeat = setInterval(() => {
		if (document.visibilityState !== "visible") return;
		channel.track({ online_at: Date.now() });
	}, HEARTBEAT_INTERVAL_MS);

	// Staleness scan: doesn't wait for any event from the departing client
	// at all — just checks whether every currently-tracked entry has
	// restamped recently. This is what actually catches mobile suspends,
	// where a `leave` may never arrive or may arrive far later than the
	// OS's own suspension. `onPlayerLeave` is expected to be idempotent
	// downstream (the caller already no-ops on an unknown/already-removed
	// player), so re-scanning an already-reported stale key is harmless.
	const staleScan = setInterval(() => {
		const state = channel.presenceState() as Record<
			string,
			Array<{ online_at?: number }>
		>;
		const now = Date.now();
		for (const [key, metas] of Object.entries(state)) {
			const lastSeen = metas[0]?.online_at ?? 0;
			if (now - lastSeen > STALE_THRESHOLD_MS) {
				onPlayerLeave(key);
			}
		}
	}, HEARTBEAT_INTERVAL_MS);

	return () => {
		clearInterval(heartbeat);
		clearInterval(staleScan);
		for (const timeout of pendingLeaves.values()) clearTimeout(timeout);
		supabase.removeChannel(channel);
	};
}
