import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalPhase = "closed" | "opening" | "open" | "closing";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	labelledBy: string;
	size?: "md" | "lg";
	children: ReactNode;
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
	md: "max-w-[560px]",
	lg: "max-w-[720px]",
};

const CLOSE_ANIMATION_MS = 180;

export default function Modal({
	open,
	onClose,
	labelledBy,
	size = "md",
	children,
}: ModalProps) {
	const [phase, setPhase] = useState<ModalPhase>(() =>
		open ? "opening" : "closed",
	);
	const [prevOpen, setPrevOpen] = useState(open);
	const panelRef = useRef<HTMLDivElement>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);

	// Adjust phase synchronously during render when `open` changes, rather
	// than in an effect, so there's no extra intermediate commit.
	if (open !== prevOpen) {
		setPrevOpen(open);
		setPhase(open ? "opening" : "closing");
	}

	// advance "opening" -> "open" a frame after mount, to let the enter transition play
	useEffect(() => {
		if (phase !== "opening") return;
		const frame = requestAnimationFrame(() => setPhase("open"));
		return () => cancelAnimationFrame(frame);
	}, [phase]);

	// advance "closing" -> "closed" (unmount) once the exit transition finishes
	useEffect(() => {
		if (phase !== "closing") return;
		const timeout = setTimeout(() => setPhase("closed"), CLOSE_ANIMATION_MS);
		return () => clearTimeout(timeout);
	}, [phase]);

	// focus management + escape-to-close + scroll lock, only while mounted
	useEffect(() => {
		if (phase === "closed") return;

		previouslyFocused.current = document.activeElement as HTMLElement | null;

		const focusable = panelRef.current?.querySelector<HTMLElement>(
			"input, button, select, textarea, [href], [tabindex]",
		);
		focusable?.focus();

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", handleKeyDown);
			previouslyFocused.current?.focus?.();
		};
	}, [phase, onClose]);

	if (phase === "closed") return null;

	const modalRoot = document.getElementById("modal-root");
	if (!modalRoot) return null;

	const visible = phase === "open";

	return createPortal(
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/70 p-4 backdrop-blur-sm transition-opacity duration-180 ease-out'
			style={{ opacity: visible ? 1 : 0 }}
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				ref={panelRef}
				role='dialog'
				aria-modal='true'
				aria-labelledby={labelledBy}
				tabIndex={-1}
				className={`flex max-h-[min(720px,90dvh)] w-full ${sizeClasses[size]} flex-col rounded-3xl border border-lavender/14 bg-gradient-to-b from-lavender/[0.06] to-lavender/[0.02] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-[18px] transition-all duration-180 ease-out`}
				style={{
					opacity: visible ? 1 : 0,
					transform: visible ? "scale(1)" : "scale(0.95)",
				}}
			>
				{children}
			</div>
		</div>,
		modalRoot,
	);
}
