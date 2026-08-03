import heroImage from "../assets/hero.png";
import PageBackground from "../components/PageBackground";
import TopBar from "../components/TopBar";
import { PrimaryLink, SecondaryLink } from "../components/Button";

function IconPlus() {
	return (
		<svg width='18' height='18' viewBox='0 0 18 18' fill='none'>
			<path
				d='M9 3v12M3 9h12'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
			/>
		</svg>
	);
}

function IconArrowRight() {
	return (
		<svg width='18' height='18' viewBox='0 0 18 18' fill='none'>
			<path
				d='M3.5 9h11M9.5 4l5 5-5 5'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	);
}

export default function Home() {
	return (
		<PageBackground>
			<TopBar />

			<main className='relative z-10 mx-auto flex w-full max-w-300 flex-1 flex-col items-center gap-12 px-6 pt-4 pb-16 text-center sm:px-10 md:flex-row md:justify-between md:pt-8 md:text-left lg:px-16'>
				<div className='flex max-w-full flex-col items-center md:max-w-140 md:items-start'>
					<h1 className='mb-5 bg-linear-to-br from-white via-lavender to-accent-blue bg-clip-text font-display text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.06] font-bold tracking-[-0.02em] text-transparent'>
						Hitster pour les bluds
					</h1>
					<p className='mx-auto mb-9 max-w-115 text-[1.05rem] leading-[1.65] text-lavender/68 md:mx-0'>
						Tannée de dépenser tout son argent pour jouer aux 4 000 différentes
						version de Hitster? Voici la copie créer par Jonathan
					</p>
					<div className='flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center md:justify-start'>
						<PrimaryLink to='/create' className='w-full sm:w-auto'>
							<IconPlus />
							Créer une partie
						</PrimaryLink>
						<SecondaryLink to='/join' className='w-full sm:w-auto'>
							<IconArrowRight />
							Rejoindre une partie
						</SecondaryLink>
					</div>
				</div>

				<div className='order-first w-[min(280px,65vw)] shrink-0 md:order-0 md:w-[min(360px,40vw)]'>
					<img
						src={heroImage}
						alt=''
						className='h-auto w-full animate-float drop-shadow-[0_30px_60px_rgba(126,20,255,0.45)] motion-reduce:animate-none'
					/>
				</div>
			</main>

			<footer className='relative z-10 border-t border-lavender/14 px-6 pt-6 pb-8 text-center text-[0.8rem] text-lavender/44 sm:px-10 lg:px-16'>
				<p>Lorem ipsum dolor sit amet · v0.1 placeholder</p>
			</footer>
		</PageBackground>
	);
}
