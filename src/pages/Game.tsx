import { useEffect, useMemo, useRef, useState } from "react";
import {
	Navigate,
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from "react-router-dom";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import type { lobbyProps, playerProps } from "../types";
import {
	deleteLobby,
	getLobbyByCode,
	leaveLobby,
	subscribeToLobbyByCode,
} from "../lib/lobbies";
import { showToast } from "../lib/toast";
import { PrimaryButton } from "../components/Button";
import Scoreboard from "../components/Scoreboard";

function IconMusic() {
	return (
		<svg width='44' height='44' viewBox='0 0 24 24' fill='none'>
			<path
				d='M9 18V5l11-2v13'
				stroke='currentColor'
				strokeWidth='1.5'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
			<circle cx='6' cy='18' r='3' stroke='currentColor' strokeWidth='1.5' />
			<circle cx='17' cy='16' r='3' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	);
}

function IconUser() {
	return (
		<svg width='22' height='22' viewBox='0 0 24 24' fill='none'>
			<circle cx='12' cy='8' r='3.5' stroke='currentColor' strokeWidth='1.6' />
			<path
				d='M4.5 19.5c1.4-3.2 4.1-5 7.5-5s6.1 1.8 7.5 5'
				stroke='currentColor'
				strokeWidth='1.6'
				strokeLinecap='round'
			/>
		</svg>
	);
}

function IconCrown() {
	return (
		<svg width='12' height='12' viewBox='0 0 20 20' fill='none'>
			<path
				d='M3 15.5h14l1.2-8-4.7 3.3L10 6l-3.5 4.8L1.8 7.5 3 15.5Z'
				stroke='currentColor'
				strokeWidth='1.4'
				strokeLinejoin='round'
			/>
		</svg>
	);
}

function IconTrophy() {
	return (
		<svg width='18' height='18' viewBox='0 0 24 24' fill='none'>
			<path
				d='M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z'
				stroke='currentColor'
				strokeWidth='1.6'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
			<path
				d='M7 5H4v1a4 4 0 0 0 4 4M17 5h3v1a4 4 0 0 1-4 4'
				stroke='currentColor'
				strokeWidth='1.6'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	);
}

const tones = [
	"bg-linear-to-br from-purple-light to-purple",
	"bg-linear-to-br from-accent-blue to-purple",
	"bg-linear-to-br from-purple-soft to-[#d63bff]",
	"bg-linear-to-br from-[#47bfff] to-[#2f8fff]",
];

export default function Game() {
	const { code } = useParams<{ code: string }>();
	const [searchParams] = useSearchParams();
	const current = searchParams.get("current");

	const navigate = useNavigate();

	const location = useLocation();
	const hadInitialLobbyRef = useRef(
		(location.state as lobbyProps | null) != null,
	);
	const [lobby, setLobby] = useState<lobbyProps | null>(
		() => (location.state as lobbyProps | null) ?? null,
	);
	const previousPlayersRef = useRef<playerProps[]>(
		(location.state as lobbyProps | null)?.player ?? [],
	);

	// Current player object
	const currentPlayer = lobby?.player.find((p) => p.id === current);

	const [notFound, setNotFound] = useState(false);

	const scoredPlayers = useMemo(
		() =>
			(lobby?.player ?? []).map((player) => ({
				...player,
				score: 0,
			})),
		[lobby?.player],
	);

	useEffect(() => {
		if (!code) return;

		let cancelled = false;

		getLobbyByCode(code).then((found) => {
			if (cancelled) return;
			if (found) {
				previousPlayersRef.current = found.player;
				setLobby(found);
			} else if (!hadInitialLobbyRef.current) {
				setNotFound(true);
			}
		});

		const unsubscribe = subscribeToLobbyByCode(
			code,
			(updated) => {
				if (cancelled) return;

				const previousIds = new Set(
					previousPlayersRef.current.map((player) => player.id),
				);
				const nextIds = new Set(updated.player.map((player) => player.id));

				for (const player of updated.player) {
					if (!previousIds.has(player.id) && player.id !== current) {
						showToast(
							`${player.pseudo || "Un joueur"} a rejoint la partie`,
							"join",
						);
					}
				}

				for (const player of previousPlayersRef.current) {
					if (!nextIds.has(player.id) && player.id !== current) {
						showToast(
							`${player.pseudo || "Un joueur"} a quitté la partie`,
							"leave",
						);
					}
				}

				previousPlayersRef.current = updated.player;
				setLobby(updated);
			},
			() => {
				// The lobby was deleted (e.g. the host left) while we were in it.
				if (!cancelled) {
					showToast("L'hôte a fermé le lobby.", "closed");
					setNotFound(true);
				}
			},
		);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [code, current]);

	async function handleLeaving() {
		if (!code || !lobby || !current) return;

		if (currentPlayer?.host) {
			await deleteLobby(code);
		} else {
			await leaveLobby(code, current);
		}

		navigate("/");
	}

	if (!code || notFound) {
		return <Navigate to='/' replace />;
	}

	if (!lobby) {
		return (
			<PageBackground>
				<TopBar />
				<main className='relative z-10 flex flex-1 items-center justify-center px-6 text-center text-lavender/68'>
					Chargement du lobby…
				</main>
			</PageBackground>
		);
	}

	return (
		<PageBackground>
			<TopBar />

			<div className='relative z-10 flex flex-wrap items-center justify-center gap-3 px-6 pb-2 text-center sm:px-10 lg:px-16'>
				<span className='rounded-full border border-lavender/14 bg-lavender/5 px-4 py-1.5 font-display text-sm font-semibold'>
					{lobby.name}
				</span>
				<span className='rounded-full border border-lavender/14 bg-lavender/5 px-4 py-1.5 text-xs text-lavender/68'>
					Code {lobby.generatedCode}
				</span>
				<span className='rounded-full border border-lavender/14 bg-lavender/5 px-4 py-1.5 text-xs text-lavender/68'>
					{lobby.public ? "Partie publique" : "Partie privée"}
				</span>
			</div>

			<main className='relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 pt-6 pb-4 sm:px-10 lg:flex-row lg:items-start lg:justify-center lg:px-16'>
				<div className='relative w-[min(360px,78vw)] shrink-0'>
					<div
						aria-hidden='true'
						className="absolute top-[14%] right-[-12%] hidden aspect-square w-[62%] rounded-full bg-[repeating-radial-gradient(circle_at_50%_50%,#16101f_0,#16101f_3px,#1f1730_4px,#1f1730_7px)] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.65)] after:absolute after:inset-[38%] after:rounded-full after:bg-linear-to-br after:from-purple-light after:to-purple after:content-[''] sm:block"
					/>

					<div className='relative z-10 aspect-square overflow-hidden rounded-3xl border border-lavender/14 bg-[linear-gradient(160deg,rgba(237,230,255,0.08),rgba(8,6,13,0.5))] shadow-[0_40px_80px_-20px_rgba(126,20,255,0.5)]'>
						<span className='absolute top-[1.1rem] left-1/2 z-10 max-w-[calc(100%-2.4rem)] -translate-x-1/2 overflow-hidden rounded-full border border-lavender/22 bg-bg-deep/55 px-5 py-2.5 font-display text-base font-semibold text-ellipsis whitespace-nowrap shadow-[0_10px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-[10px]'>
							Lorem Ipsum Dolor Sit
						</span>

						<div className='flex h-full flex-col items-center justify-center gap-3 bg-[repeating-linear-gradient(-45deg,rgba(237,230,255,0.05)_0,rgba(237,230,255,0.05)_12px,rgba(237,230,255,0.02)_12px,rgba(237,230,255,0.02)_24px)] text-lavender/44'>
							<IconMusic />
							<span className='text-[0.8rem] tracking-[0.03em] uppercase'>
								Image placeholder
							</span>
						</div>
					</div>
				</div>

				<div className='absolute right-0 mr-4 w-full max-w-sm rounded-3xl border border-lavender/14 bg-lavender/5 p-5 backdrop-blur-lg'>
					<div className='mb-4 flex items-center gap-2'>
						<IconTrophy />
						<h2 className='font-display text-lg font-bold'>Classement</h2>
					</div>
					<Scoreboard players={scoredPlayers} currentPlayerId={current} />
				</div>
			</main>

			<footer className='relative z-10 flex justify-center px-4 pt-4 pb-7 sm:px-12'>
				<PrimaryButton
					type='submit'
					className='m-4 w-fit absolute bottom-0 left-0'
					onClick={handleLeaving}
				>
					Quitter la partie
				</PrimaryButton>
				<ul className='flex max-w-full items-start gap-6 overflow-x-auto rounded-3xl border border-lavender/14 bg-lavender/5 px-6 py-4 backdrop-blur-lg'>
					{lobby.player.map((player, index) => {
						const isYou = player.id === current;

						return (
							<li
								key={player.id}
								className='relative flex w-17 shrink-0 flex-col items-center gap-[0.45rem]'
							>
								<span
									className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-white ${tones[index % tones.length]} ${
										isYou
											? "border-accent-blue shadow-[0_0_0_3px_rgba(71,191,255,0.25)]"
											: "border-white/16"
									}`}
								>
									<IconUser />
									{player.host && (
										<span className='absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-lavender/14 bg-bg-deep text-accent-blue'>
											<IconCrown />
										</span>
									)}
								</span>
								<span className='w-17 truncate text-center text-[0.78rem] text-lavender/68'>
									{player.pseudo || "Anonyme"}
									{isYou && " (toi)"}
								</span>
							</li>
						);
					})}
				</ul>
			</footer>
		</PageBackground>
	);
}
