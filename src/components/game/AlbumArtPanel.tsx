import { IconMusic } from "../icons/GameIcons";

export default function AlbumArtPanel() {
	return (
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
	);
}
