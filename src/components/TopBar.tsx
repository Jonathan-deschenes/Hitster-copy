import { Link } from "react-router-dom";

export default function TopBar() {
	return (
		<header className='relative z-10 flex items-center justify-between px-6 py-7 sm:px-10 lg:px-16'>
			<Link
				to='/'
				className='flex items-center gap-2.5 text-inherit no-underline'
			>
				<img src='/favicon.svg' alt='' className='h-[30px] w-auto' />
				<span className='font-display text-[1.05rem] font-semibold tracking-tight'>
					Bludster
				</span>
			</Link>
		</header>
	);
}
