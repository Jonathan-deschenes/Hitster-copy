import Modal, { ModalCloseButton } from "./Modal";
import CreateGameForm from "./CreateGameForm";
import JoinGameForm from "./JoinGameForm";

export type PlayModalTab = "create" | "join";

interface PlayModalProps {
	open: boolean;
	tab: PlayModalTab;
	onTabChange: (tab: PlayModalTab) => void;
	onClose: () => void;
}

const TABS: { id: PlayModalTab; label: string }[] = [
	{ id: "create", label: "Créer" },
	{ id: "join", label: "Rejoindre" },
];

export default function PlayModal({
	open,
	tab,
	onTabChange,
	onClose,
}: PlayModalProps) {
	return (
		<Modal open={open} onClose={onClose} labelledBy='play-modal-title' size='lg'>
			<div className='flex shrink-0 items-start justify-between gap-4 p-6 pb-0 sm:p-8 sm:pb-0'>
				<div>
					<span className='mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-lavender/14 bg-purple/[0.14] px-3.5 py-1.5 text-[0.78rem] font-medium tracking-[0.04em] text-purple-soft uppercase'>
						<span className='h-1.5 w-1.5 rounded-full bg-accent-blue shadow-[0_0_8px_#47bfff]' />
						Jouer
					</span>
					<h1
						id='play-modal-title'
						className='font-display text-[clamp(1.4rem,3vw,1.75rem)] font-bold tracking-[-0.01em]'
					>
						{tab === "create" ? "Créer une partie" : "Rejoindre une partie"}
					</h1>
				</div>

				<ModalCloseButton onClose={onClose} />
			</div>

			<div className='shrink-0 px-6 pt-5 sm:px-8'>
				<div className='inline-flex w-full gap-1.5 rounded-2xl border border-lavender/14 bg-lavender/[0.04] p-1.5'>
					{TABS.map(({ id, label }) => (
						<button
							key={id}
							type='button'
							onClick={() => onTabChange(id)}
							aria-pressed={tab === id}
							className={`flex-1 rounded-xl px-4 py-2.5 text-[0.9rem] font-semibold transition-all duration-200 ${
								tab === id
									? "bg-linear-to-br from-purple-light via-purple to-accent-blue text-white shadow-[0_10px_28px_-8px_rgba(126,20,255,0.7)]"
									: "text-lavender/68 hover:text-white"
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			<div className='min-h-0 flex-1 overflow-y-auto p-6 pt-5 sm:p-8 sm:pt-5'>
				{tab === "create" ? <CreateGameForm /> : <JoinGameForm />}
			</div>
		</Modal>
	);
}
