import { useState } from "react";
import { useNavigate } from "react-router-dom";
import heroImage from "../assets/hero.png";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import { PrimaryButton, SecondaryButton } from "../components/Button";
import { IconArrowRight, IconPlus } from "../components/icons/FormIcons";
import PlayModal, { type PlayModalTab } from "../components/PlayModal";

interface HomeProps {
	initialTab?: PlayModalTab;
}

export default function Home({ initialTab }: HomeProps) {
	const navigate = useNavigate();
	const [tab, setTab] = useState<PlayModalTab>(initialTab ?? "create");
	const [open, setOpen] = useState(!!initialTab);

	const openModal = (nextTab: PlayModalTab) => {
		setTab(nextTab);
		setOpen(true);
	};

	const closeModal = () => {
		setOpen(false);
		if (initialTab) navigate("/", { replace: true });
	};

	return (
		<PageBackground>
			<TopBar />

			<main className='relative z-10 mx-auto flex w-full max-w-300 min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center sm:gap-10 sm:px-10 md:flex-row md:justify-between md:text-left lg:px-16'>
				<div className='flex max-w-full flex-col items-center md:max-w-140 md:items-start'>
					<h1 className='mb-3 bg-linear-to-br from-white via-lavender to-accent-blue bg-clip-text font-display text-[clamp(2.2rem,5vw,3.75rem)] leading-[1.06] font-bold tracking-[-0.02em] text-transparent sm:mb-5'>
						Hitster pour les bluds
					</h1>
					<p className='mx-auto mb-5 max-w-115 text-[0.95rem] leading-[1.6] text-lavender/68 sm:mb-8 sm:text-[1.05rem] sm:leading-[1.65] md:mx-0'>
						Tannée de dépenser tout son argent pour jouer aux 4 000 différentes
						version de Hitster? Voici Bludster, une copie du jeu de musique
						créer par Jonathan
					</p>
					<div className='flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4 md:justify-start'>
						<PrimaryButton
							className='w-full sm:w-auto'
							onClick={() => openModal("create")}
						>
							<IconPlus />
							Créer une partie
						</PrimaryButton>
						<SecondaryButton
							className='w-full sm:w-auto'
							onClick={() => openModal("join")}
						>
							<IconArrowRight />
							Rejoindre une partie
						</SecondaryButton>
					</div>
				</div>

				<div className='order-first w-[min(240px,55vw,32dvh)] shrink-0 md:order-0 md:w-[min(360px,40vw,42dvh)]'>
					<img
						src={heroImage}
						alt=''
						className='h-auto w-full animate-float drop-shadow-[0_30px_60px_rgba(126,20,255,0.45)] motion-reduce:animate-none'
					/>
				</div>
			</main>

			<footer className='relative z-10 shrink-0 border-t border-lavender/14 px-6 py-3 text-center text-[0.8rem] text-lavender/44 sm:px-10 lg:px-16'>
				<p>Bludster · v0.1</p>
			</footer>

			<PlayModal
				open={open}
				tab={tab}
				onTabChange={setTab}
				onClose={closeModal}
			/>
		</PageBackground>
	);
}
