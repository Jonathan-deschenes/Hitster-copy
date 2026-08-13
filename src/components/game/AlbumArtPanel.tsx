import { IconMusic } from "../icons/GameIcons";
import { GameMode, GameStatus } from "../../types";
import type { gameStateProps, musicItemsProps } from "../../types";
import { parseReleaseYear } from "../../lib/scoring";

interface AlbumArtPanelProps {
	currentTrack?: musicItemsProps;
	gameState?: gameStateProps;
}

export default function AlbumArtPanel({
	currentTrack,
	gameState,
}: AlbumArtPanelProps) {
	const coverImage = currentTrack?.cover;
	const revealed = gameState?.status === GameStatus.Finished;
	const year = parseReleaseYear(currentTrack?.releaseDate);
	// The round's resolved target, so an "Aléatoire" game reveals whatever it
	// actually asked about rather than always falling through to the title.
	const revealMode = gameState?.questionMode ?? gameState?.mode;
	const isPlaying = gameState?.status === GameStatus.Playing;

	return (
		<div className='relative w-[min(360px,78vw,52dvh)] shrink-0'>
			<div className="absolute top-[14%] right-[-12%] hidden aspect-square w-[62%] rounded-full bg-[repeating-radial-gradient(circle_at_50%_50%,#16101f_0,#16101f_3px,#1f1730_4px,#1f1730_7px)] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.65)] after:absolute after:inset-[38%] after:rounded-full after:bg-linear-to-br after:from-purple-light after:to-purple after:content-[''] sm:block" />

			<div
				className={`relative z-10 block aspect-square w-full overflow-hidden rounded-3xl border transition ${
					isPlaying
						? "border-accent-blue/50 bg-[linear-gradient(160deg,rgba(237,230,255,0.08),rgba(8,6,13,0.5))] motion-safe:animate-pulse-glow"
						: "border-lavender/14 bg-[linear-gradient(160deg,rgba(237,230,255,0.08),rgba(8,6,13,0.5))] shadow-[0_40px_80px_-20px_rgba(126,20,255,0.5)]"
				}`}
			>
				{!revealed ? (
					<div className='bg-lavender h-full w-full bg-purple'></div>
				) : revealed && coverImage ? (
					<img
						src={coverImage.url}
						alt={revealed ? currentTrack?.name : "Pochette cachée"}
						width={coverImage.width ?? undefined}
						height={coverImage.height ?? undefined}
						className={`h-full w-full object-cover transition duration-500 ease-out ${
							revealed ? "scale-100 blur-none" : "scale-110 blur-[200px]"
						}`}
					/>
				) : (
					!coverImage && (
						<div className='flex h-full flex-col items-center justify-center gap-3 bg-[repeating-linear-gradient(-45deg,rgba(237,230,255,0.05)_0,rgba(237,230,255,0.05)_12px,rgba(237,230,255,0.02)_12px,rgba(237,230,255,0.02)_24px)] text-lavender/44'>
							<IconMusic />
							<span className='text-[0.8rem] tracking-[0.03em] uppercase'>
								En attente du morceau…
							</span>
						</div>
					)
				)}

				{/* Bottom scrim so the title stays legible over any cover */}
				<div className='pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(8,6,13,0.92)_0%,rgba(8,6,13,0.15)_55%,transparent_75%)]' />

				<div className='absolute inset-x-0 bottom-0 z-10 px-5 pb-4 text-left'>
					{year && (
						<span className='mb-1.5 inline-block rounded-full border border-lavender/22 bg-bg-deep/55 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-[0.03em] text-lavender/80 backdrop-blur-[6px]'>
							{revealed ? year : "????"}
						</span>
					)}
					<h2 className='truncate font-display text-xl font-semibold text-white'>
						{revealed
							? revealMode === GameMode.Titre
								? (currentTrack?.album ?? "Album indisponible")
								: (currentTrack?.name ?? "Titre indisponible")
							: "Titre caché"}
					</h2>
					<p className='truncate text-sm text-lavender/68'>
						{revealed && revealMode !== GameMode.Titre
							? (currentTrack?.artist.join(", ") ?? "")
							: "Devine avant de révéler !"}
					</p>
				</div>
			</div>
		</div>
	);
}
