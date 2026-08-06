import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeSpotifyLogin } from "../lib/spotify/auth";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";

export default function SpotifyCallback() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const [asyncError, setAsyncError] = useState<string | null>(null);
	const ranOnce = useRef(false);

	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const spotifyError = searchParams.get("error");

	const paramsError = spotifyError
		? "Connexion Spotify refusée."
		: !code || !state
			? "Réponse Spotify invalide."
			: null;

	useEffect(() => {
		if (ranOnce.current || paramsError || !code || !state) return;
		ranOnce.current = true;

		completeSpotifyLogin(code, state)
			.then((returnTo) => navigate(returnTo, { replace: true }))
			.catch((err) => {
				console.error(err);
				setAsyncError("Impossible de finaliser la connexion Spotify.");
			});
	}, [code, state, paramsError, navigate]);

	const error = paramsError ?? asyncError;

	return (
		<PageBackground>
			<TopBar />
			<main className='relative z-10 flex flex-1 items-center justify-center px-6 text-center text-lavender/68'>
				{error ?? "Connexion à Spotify…"}
			</main>
		</PageBackground>
	);
}
