import type { ReactNode } from "react";
import { Link } from "react-router-dom";

function IconArrowLeft() {
	return (
		<svg width='16' height='16' viewBox='0 0 18 18' fill='none'>
			<path
				d='M14.5 9h-11M8.5 4l-5 5 5 5'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	);
}

interface FormCardProps {
	eyebrow: string;
	title: string;
	subtitle: string;
	children: ReactNode;
}

export default function FormCard({
	eyebrow,
	title,
	subtitle,
	children,
}: FormCardProps) {
	return (
		<main className='relative z-10 flex flex-1 items-center justify-center px-5 pt-6 pb-16 sm:px-10 lg:px-16'>
			<div className='w-full flex flex-col max-w-[960px] rounded-3xl border border-lavender/14 bg-gradient-to-b from-lavender/[0.06] to-lavender/[0.02] p-7 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-[18px] sm:p-11'>
				<Link
					to='/'
					className='mb-6 inline-flex items-center gap-1.5 text-[0.85rem] text-lavender/68 no-underline transition-colors hover:text-white'
				>
					<IconArrowLeft />
					Retour
				</Link>

				<span className='w-fit mb-6 inline-flex items-center gap-2 rounded-full border border-lavender/14 bg-purple/[0.14] px-3.5 py-1.5 text-[0.78rem] font-medium tracking-[0.04em] text-purple-soft uppercase'>
					<span className='h-1.5 w-1.5 rounded-full bg-accent-blue shadow-[0_0_8px_#47bfff]' />
					{eyebrow}
				</span>

				<h1 className='mb-2.5 font-display text-[clamp(1.6rem,3vw,2.1rem)] font-bold tracking-[-0.01em]'>
					{title}
				</h1>
				<p className='mb-8 text-[0.95rem] leading-[1.6] text-lavender/68'>
					{subtitle}
				</p>

				{children}
			</div>
		</main>
	);
}
