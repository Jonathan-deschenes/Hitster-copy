import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeSpotifyLogin } from "../lib/spotify/auth";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";

export default function SpotifyCallback() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const ranOnce = useRef(false);

	useEffect(() => {
		if (ranOnce.current) return;
		ranOnce.current = true;

		const code = searchParams.get("code");
		const state = searchParams.get("state");
		const spotifyError = searchParams.get("error");

		if (spotifyError) {
			setError("Connexion Spotify refusée.");
			return;
		}

		if (!code || !state) {
			setError("Réponse Spotify invalide.");
			return;
		}

		completeSpotifyLogin(code, state)
			.then((returnTo) => navigate(returnTo, { replace: true }))
			.catch((err) => {
				console.error(err);
				setError("Impossible de finaliser la connexion Spotify.");
			});
	}, [searchParams, navigate]);

	return (
		<PageBackground>
			<TopBar />
			<main className='relative z-10 flex flex-1 items-center justify-center px-6 text-center text-lavender/68'>
				{error ?? "Connexion à Spotify…"}
			</main>
		</PageBackground>
	);
}
