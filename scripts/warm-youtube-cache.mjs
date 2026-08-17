// Warms `youtube_match_cache` for every playlist in the app, resolving each
// Spotify track to its YouTube candidates at most once — ever.
//
// Default mode is the NO-QUOTA resolver: candidate video ids come from YouTube's
// public "innertube" search (zero Data API units), and `youtube-match` only
// spends the cheap ~1-unit/50 videos.list verify to confirm embeddability and
// write the cache. So the whole catalog warms for a couple hundred units total,
// in a single run, instead of ~100 units per track. Pass --api-search to use the
// metered Data API search.list path instead.
//
// Why this is efficient either way:
//   * Every playlist's FULL track list is fetched (no random sampling), then
//     deduped by Spotify track id across all playlists — a track shared between
//     playlists is resolved once, not once per playlist.
//   * A local progress file (`scripts/.youtube-cache-progress.json`) records
//     tracks already processed, so a re-run never re-resolves and --max-tracks
//     lets you split the work across runs.
//
// Usage (from the project root, or `npm run warm-cache -- <flags>`):
//   node scripts/warm-youtube-cache.mjs --dry-run      # report counts only, no network beyond Spotify
//   node scripts/warm-youtube-cache.mjs                # cache everything pending, no quota
//   node scripts/warm-youtube-cache.mjs --api-search   # use the metered Data API search instead
//
// Flags:
//   --dry-run          Fetch playlists and report counts + quota estimate; no resolving/caching.
//   --api-search       Use the metered 100-unit Data API search instead of the no-quota resolver.
//   --max-tracks N     Attempt at most N not-yet-processed tracks this run (default: all).
//   --chunk-size N     Tracks per youtube-match call (default: 10).
//   --playlists a,b,c  Comma-separated playlist ids to override the app's default list.

import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = join(SCRIPT_DIR, ".youtube-cache-progress.json");

// Keep in sync with `musicStyle` in src/constants/createGameOptions.ts.
const DEFAULT_PLAYLIST_IDS = [
	"2EtWHTBuXqWGpG6JmFkM5O", // Summer party
	"3tRlJUnhjHmNMTQM5dIV1b", // Francophone
	"4PaAYhJOgMIdWKkAKx3KBU", // Rock
	"4hS4xpg6lzOrKqA3kAbGdW", // Jeux vidéo
	"4OU4FTKX6U5rlPy7qNiaDg", // Films et émission
	"09cv5duYGfbvb9kh8Z0iGj", // Test
];

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
	const args = { dryRun: false, apiSearch: false, maxTracks: Infinity, chunkSize: 10, playlists: DEFAULT_PLAYLIST_IDS };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--dry-run") args.dryRun = true;
		else if (arg === "--api-search") args.apiSearch = true;
		else if (arg === "--max-tracks") args.maxTracks = Number(argv[++i]);
		else if (arg === "--chunk-size") args.chunkSize = Number(argv[++i]);
		else if (arg === "--playlists") args.playlists = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
		else {
			console.error(`Unknown argument: ${arg}`);
			process.exit(1);
		}
	}
	if (!Number.isFinite(args.chunkSize) || args.chunkSize < 1) {
		console.error("--chunk-size must be a positive integer");
		process.exit(1);
	}
	return args;
}

// ---------------------------------------------------------------------------
// Progress file (client-side mirror of what's been searched — the cache table
// itself is unreadable with the anon key, RLS is locked to the service role)
// ---------------------------------------------------------------------------

function loadDone() {
	if (!existsSync(PROGRESS_FILE)) return new Set();
	try {
		const parsed = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
		return new Set(Array.isArray(parsed.done) ? parsed.done : []);
	} catch {
		console.warn("Could not parse progress file; starting fresh.");
		return new Set();
	}
}

function saveDone(doneSet) {
	writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...doneSet] }, null, "\t"));
}

// ---------------------------------------------------------------------------
// Edge Function helpers
// ---------------------------------------------------------------------------

/** Pull the real error message out of a FunctionsHttpError's Response body. */
async function readFunctionError(error) {
	const context = error?.context;
	if (!(context instanceof Response)) return error?.message ?? null;
	try {
		const body = await context.clone().json();
		return typeof body?.error === "string" ? body.error : null;
	} catch {
		return null;
	}
}

const QUOTA_PATTERN = /quota|rate ?limit|RESOURCE_EXHAUSTED|429|403/i;

// ---------------------------------------------------------------------------
// No-quota resolver: YouTube's public "innertube" search returns the same
// candidate ids as the metered Data API search.list, at zero quota. We resolve
// candidates here, then hand them to `youtube-match`, which only spends the
// cheap ~1-unit/50 videos.list verify — no 100-unit search per track.
// ---------------------------------------------------------------------------

// Public web-client key baked into youtube.com itself; it gates the innertube
// endpoint but is NOT metered against a Cloud project's quota.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const INNERTUBE_SEARCH_URL = `https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}&prettyPrint=false`;
const INNERTUBE_CONTEXT = {
	client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "en", gl: "US" },
};
// Base64 protobuf for the "type = Video" search filter (drops channels/playlists).
const VIDEO_FILTER_PARAMS = "EgIQAQ==";
const RAW_CANDIDATES = 8; // mirrors RAW_CANDIDATES_PER_TRACK in the Edge Function

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Walks the innertube response tree collecting videoRenderer ids in order — a
 *  recursive scan is resilient to YouTube shuffling where in the tree they sit. */
function collectVideoIds(node, out = []) {
	if (Array.isArray(node)) {
		for (const child of node) collectVideoIds(child, out);
	} else if (node && typeof node === "object") {
		if (typeof node.videoRenderer?.videoId === "string") out.push(node.videoRenderer.videoId);
		for (const key of Object.keys(node)) collectVideoIds(node[key], out);
	}
	return out;
}

/** Up to RAW_CANDIDATES video ids for a track, via the unmetered public search. */
async function resolveYoutubeIds(track) {
	const query = `${track.artist.join(" ")} ${track.name}`.trim();
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const res = await fetch(INNERTUBE_SEARCH_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ context: INNERTUBE_CONTEXT, query, params: VIDEO_FILTER_PARAMS }),
			});
			if (!res.ok) throw new Error(`innertube ${res.status}`);
			const data = await res.json();
			return [...new Set(collectVideoIds(data))].slice(0, RAW_CANDIDATES);
		} catch (err) {
			if (attempt === 1) {
				console.warn(`\n  resolve failed for "${query}": ${err.message}`);
				return [];
			}
			await sleep(600);
		}
	}
	return [];
}

const chunk = (arr, size) =>
	Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const url = process.env.VITE_SUPABASE_URL;
	const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local");
		process.exit(1);
	}
	const supabase = createClient(url, anonKey);

	// 1. Fetch every playlist in full. Sequential on purpose: `spotify-playlist`
	//    refreshes Spotify's single-use PKCE token on each call, so parallel
	//    invocations would race and invalidate each other's token.
	const tracksById = new Map();
	for (const playlistId of args.playlists) {
		process.stdout.write(`Fetching playlist ${playlistId} … `);
		const { data, error } = await supabase.functions.invoke("spotify-playlist", {
			body: { playlistId }, // no maxTracks ⇒ the whole playlist
		});
		if (error || !data) {
			console.log("FAILED");
			console.error(`  ${(await readFunctionError(error)) ?? "unknown error"}`);
			process.exit(1);
		}
		for (const track of data.musics ?? []) {
			if (!tracksById.has(track.id)) {
				tracksById.set(track.id, { id: track.id, name: track.name, artist: track.artist });
			}
		}
		console.log(`${data.musics?.length ?? 0} tracks (unique so far: ${tracksById.size})`);
	}

	// 2. Dedup vs what's already been searched.
	const done = loadDone();
	const uniqueTracks = [...tracksById.values()];
	const pending = uniqueTracks.filter((t) => !done.has(t.id));

	// Resolver mode spends only the cheap videos.list verify (~1 unit / 50
	// candidate ids); --api-search spends the 100-unit search.list per track.
	const quotaLine = args.apiSearch
		? `up to ${pending.length * 100} units (${Math.ceil(pending.length / 95)} day(s) at ~95/day)`
		: `≈ ${Math.ceil((pending.length * RAW_CANDIDATES) / 50)} units total (verify only — no per-track search)`;

	console.log("\n── Summary ─────────────────────────────");
	console.log(`Mode:                   ${args.apiSearch ? "API search (metered)" : "no-quota resolver"}`);
	console.log(`Playlists scanned:      ${args.playlists.length}`);
	console.log(`Unique tracks:          ${uniqueTracks.length}`);
	console.log(`Already processed:      ${uniqueTracks.length - pending.length}`);
	console.log(`Pending:                ${pending.length}`);
	console.log(`Est. YouTube quota:     ${quotaLine}`);
	console.log("────────────────────────────────────────\n");

	if (args.dryRun) {
		console.log("Dry run — no YouTube quota spent.");
		return;
	}
	if (pending.length === 0) {
		console.log("Nothing pending. Cache is fully warmed for these playlists. ✅");
		return;
	}

	// 3. Process this run's slice, chunk by chunk, saving progress after each so
	//    a mid-run quota stop loses at most one chunk of work.
	const thisRun = pending.slice(0, args.maxTracks);
	const chunks = chunk(thisRun, args.chunkSize);
	let matchedTracks = 0;
	let processed = 0;

	for (let i = 0; i < chunks.length; i++) {
		const batch = chunks[i];
		process.stdout.write(`Chunk ${i + 1}/${chunks.length} (${batch.length} tracks) … `);

		// No-quota mode: resolve candidate ids locally, then hand them to
		// youtube-match so it verifies + caches without spending a search.
		let payload = batch;
		if (!args.apiSearch) {
			const resolved = await Promise.all(batch.map((track) => resolveYoutubeIds(track)));
			payload = batch.map((track, idx) => ({ ...track, youtubeIds: resolved[idx] }));
		}

		const { data, error } = await supabase.functions.invoke("youtube-match", {
			body: { tracks: payload },
		});

		if (error || !data) {
			const detail = await readFunctionError(error);
			console.log("FAILED");
			console.error(`  ${detail ?? "unknown error"}`);
			saveDone(done);
			if (detail && QUOTA_PATTERN.test(detail)) {
				console.log(`\nDaily quota reached. Progress saved — re-run tomorrow to resume.`);
				console.log(`Cached this run: ${matchedTracks} tracks across ${processed} searched.`);
			}
			process.exit(1);
		}

		const matchCounts = Object.values(data.matches ?? {}).map((ids) => ids.length);
		const matchedInBatch = matchCounts.filter((n) => n > 0).length;
		matchedTracks += matchedInBatch;
		processed += batch.length;

		// Mark every track we searched as done — including no-match ones, so the
		// script never wastes a second search on a track YouTube has nothing for.
		for (const track of batch) done.add(track.id);
		saveDone(done);

		console.log(`${matchedInBatch}/${batch.length} matched (verified ids: ${sum(matchCounts)})`);
	}

	console.log(`\nDone. Searched ${processed} new tracks, ${matchedTracks} matched and cached.`);
	const stillPending = pending.length - thisRun.length;
	if (stillPending > 0) {
		console.log(`${stillPending} still pending — run again (optionally with --max-tracks) to continue.`);
	} else {
		console.log("All playlists fully warmed. ✅");
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
