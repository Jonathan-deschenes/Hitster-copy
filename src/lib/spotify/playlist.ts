import type { musicItemsProps } from "../../types";
import { supabase } from "../supabaseClient";

type SpotifyPlaylistResponse = {
	musics: musicItemsProps[];
};

export async function fetchPlaylistTracks(
	playlistId: string,
	maxTracks?: number,
): Promise<musicItemsProps[]> {
	const { data, error } = await supabase.functions.invoke<SpotifyPlaylistResponse>(
		"spotify-playlist",
		{ body: { playlistId, maxTracks } },
	);

	if (error || !data) {
		throw new Error("Impossible de récupérer la playlist Spotify.");
	}

	return data.musics;
}
