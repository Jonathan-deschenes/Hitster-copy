import { supabase } from "../supabaseClient";

type TrackQuery = {
	id: string;
	name: string;
	artist: string[];
};

type YoutubeMatchResponse = {
	matches: Record<string, string[]>;
};

/** Candidate video ids per track, ranked by search relevance — never just one, see `youtube-match`. */
export async function matchYoutubeVideos(
	tracks: TrackQuery[],
): Promise<Record<string, string[]>> {
	const { data, error } = await supabase.functions.invoke<YoutubeMatchResponse>(
		"youtube-match",
		{ body: { tracks } },
	);

	if (error || !data) {
		throw new Error("Impossible de trouver les vidéos YouTube correspondantes.");
	}

	return data.matches;
}
