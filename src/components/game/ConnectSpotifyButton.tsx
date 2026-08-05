import { SecondaryButton } from "../Button";
import { redirectToSpotifyLogin } from "../../lib/spotify/auth";

interface ConnectSpotifyButtonProps {
	className?: string;
}

export default function ConnectSpotifyButton({ className }: ConnectSpotifyButtonProps) {
	return (
		<SecondaryButton
			type='button'
			className={className}
			onClick={() =>
				redirectToSpotifyLogin(window.location.pathname + window.location.search)
			}
		>
			Connecter Spotify
		</SecondaryButton>
	);
}
