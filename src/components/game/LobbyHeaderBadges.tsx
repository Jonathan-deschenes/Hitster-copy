interface LobbyHeaderBadgesProps {
	name: string;
	code: string;
	isPublic: boolean;
}

export default function LobbyHeaderBadges({
	name,
	code,
	isPublic,
}: LobbyHeaderBadgesProps) {
	return (
		<div className='relative z-10 flex flex-wrap items-center justify-center gap-3 px-6 pb-2 text-center sm:px-10 lg:px-16'>
			<span className='rounded-full border border-lavender/14 bg-lavender/5 px-4 py-1.5 font-display text-sm font-semibold'>
				{name}
			</span>
			<span className='rounded-full border border-lavender/14 bg-lavender/5 px-4 py-1.5 text-xs text-lavender/68'>
				Code {code}
			</span>
			<span className='rounded-full border border-lavender/14 bg-lavender/5 px-4 py-1.5 text-xs text-lavender/68'>
				{isPublic ? "Partie publique" : "Partie privée"}
			</span>
		</div>
	);
}
