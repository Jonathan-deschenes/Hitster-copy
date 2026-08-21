import type { musicItemsProps } from "../../types";
import { supabase } from "../supabaseClient";

/** What the Spotify catalog actually returns — everything but the YouTube match, which is added separately. */
export type spotifyTrackProps = musicItemsProps;

type SpotifyPlaylistResponse = {
	musics: spotifyTrackProps[];
};

export async function fetchPlaylistTracks(
	playlistId: string,
	maxTracks?: number,
): Promise<spotifyTrackProps[]> {
	const { data, error } = await supabase.functions.invoke<SpotifyPlaylistResponse>(
		"spotify-playlist",
		{ body: { playlistId, maxTracks } },
	);

	if (error || !data) {
		throw new Error("Impossible de récupérer la playlist Spotify.");
	}

	return data.musics;
}
