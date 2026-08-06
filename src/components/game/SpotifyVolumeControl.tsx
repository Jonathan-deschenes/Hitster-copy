import { IconVolume } from "../icons/GameIcons";

interface SpotifyVolumeControlProps {
	volume: number;
	onChange: (volume: number) => void;
}

export default function SpotifyVolumeControl({
	volume,
	onChange,
}: SpotifyVolumeControlProps) {
	return (
		<label className='flex items-center gap-2 text-lavender/68'>
			<IconVolume />
			<input
				type='range'
				min={0}
				max={100}
				value={Math.round(volume * 100)}
				onChange={(e) => onChange(Number(e.target.value) / 100)}
				className='w-28 accent-accent-blue'
				aria-label='Volume Spotify'
			/>
		</label>
	);
}
