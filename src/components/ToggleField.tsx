interface ToggleFieldProps {
	id: string;
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	hint: string;
}

export default function ToggleField({
	id,
	label,
	checked,
	onChange,
	hint,
}: ToggleFieldProps) {
	return (
		<div className='flex items-center justify-between gap-4 control-shell'>
			<div>
				<label
					htmlFor={id}
					className='cursor-pointer text-[0.9rem] font-semibold'
				>
					{label}
				</label>
				<p className='mt-0.5 text-[0.8rem] leading-[1.5] text-lavender/44'>
					{hint}
				</p>
			</div>
			<label className='relative inline-flex h-[26px] w-[46px] flex-shrink-0 cursor-pointer'>
				<input
					id={id}
					type='checkbox'
					checked={checked}
					onChange={(event) => onChange(event.target.checked)}
					className='peer absolute inset-0 h-full w-full cursor-pointer opacity-0'
					data-1p-ignore
				/>
				<span className='absolute inset-0 rounded-full border border-lavender/14 bg-lavender/14 transition-colors duration-200 peer-checked:border-transparent peer-checked:bg-gradient-to-br peer-checked:from-purple-light peer-checked:to-purple peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-blue' />
				<span className='pointer-events-none absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-5' />
			</label>
		</div>
	);
}
