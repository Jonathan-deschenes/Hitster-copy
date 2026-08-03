import { useState, type InputHTMLAttributes } from "react";

function IconEye() {
	return (
		<svg width='18' height='18' viewBox='0 0 18 18' fill='none'>
			<path
				d='M1.5 9s2.7-5.25 7.5-5.25S16.5 9 16.5 9s-2.7 5.25-7.5 5.25S1.5 9 1.5 9Z'
				stroke='currentColor'
				strokeWidth='1.5'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
			<circle cx='9' cy='9' r='2.25' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	);
}

function IconEyeOff() {
	return (
		<svg width='18' height='18' viewBox='0 0 18 18' fill='none'>
			<path
				d='M2.25 2.25l13.5 13.5M7.4 7.55a2.25 2.25 0 0 0 3.05 3.05M5.1 5.16C3.1 6.3 1.5 9 1.5 9s2.7 5.25 7.5 5.25c1.36 0 2.53-.42 3.5-1.02M9 3.75c4.8 0 7.5 5.25 7.5 5.25a12 12 0 0 1-1.98 2.73'
				stroke='currentColor'
				strokeWidth='1.5'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	);
}

interface PasswordFieldProps extends Omit<
	InputHTMLAttributes<HTMLInputElement>,
	"id" | "type"
> {
	id: string;
	label: string;
	hint?: string;
	optional?: boolean;
}

export default function PasswordField({
	id,
	label,
	hint,
	...props
}: PasswordFieldProps) {
	const [show, setShow] = useState(false);

	return (
		<div className='flex flex-col gap-2'>
			<label htmlFor={id} className='text-[0.9rem] font-semibold'>
				{label}{" "}
			</label>
			<div className='relative flex'>
				<input
					id={id}
					name={id}
					type={show ? "text" : "password"}
					placeholder='Lorem ipsum'
					autoComplete='new-password'
					className='w-full rounded-xl border border-lavender/14 bg-bg-deep/55 py-3.5 pr-11 pl-4 text-[0.95rem] text-inherit transition-colors duration-200 placeholder:text-lavender/44 hover:border-lavender/28 focus:border-purple-soft focus:bg-purple/[0.08] focus:shadow-[0_0_0_3px_rgba(126,20,255,0.22)] focus:outline-none'
					{...props}
				/>
				<button
					type='button'
					onClick={() => setShow((value) => !value)}
					aria-label={
						show ? "Masquer le mot de passe" : "Afficher le mot de passe"
					}
					className='absolute top-1/2 right-[0.35rem] inline-flex h-[2.2rem] w-[2.2rem] -translate-y-1/2 items-center justify-center rounded-lg text-lavender/68 transition-colors hover:bg-lavender/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue'
				>
					{show ? <IconEyeOff /> : <IconEye />}
				</button>
			</div>
			{hint && (
				<p className='text-[0.8rem] leading-[1.5] text-lavender/44'>{hint}</p>
			)}
		</div>
	);
}
