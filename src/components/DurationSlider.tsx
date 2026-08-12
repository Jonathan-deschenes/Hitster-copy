import {
	DURATION_MAX,
	DURATION_MIN,
	DURATION_STEP,
} from "../constants/createGameOptions";

interface DurationSliderProps {
	/** Must be unique per rendered form — the create and settings forms differ. */
	id: string;
	value: number;
	onChange: (duration: number) => void;
}

export default function DurationSlider({
	id,
	value,
	onChange,
}: DurationSliderProps) {
	return (
		<div className='flex flex-col gap-2'>
			<label htmlFor={id} className='field-label'>
				Durée des extraits
			</label>
			<div className='control-shell flex items-center gap-3'>
				<input
					id={id}
					type='range'
					min={DURATION_MIN}
					max={DURATION_MAX}
					step={DURATION_STEP}
					value={value}
					onChange={(e) => onChange(Number(e.target.value))}
					className='w-full accent-accent-blue'
				/>
				<span className='w-10 shrink-0 text-right text-[0.9rem] text-lavender/68'>
					{value}s
				</span>
			</div>
		</div>
	);
}
