import { useState, type FormEvent } from "react";
import { PrimaryButton } from "../Button";
import { IconChat, IconSend } from "../icons/GameIcons";
import { GameStatus } from "../../types";
import type { gameStateProps, musicItemsProps, playerProps } from "../../types";
import { showToast } from "../../lib/toast";
import LobbyAnswerBox from "./LobbyAnswerBox";

interface LobbyQuestionBoxProps {
	className?: string;
	question: string;
	answerAction: (answer: string, playerId: string) => Promise<void>;
	currentPlayer: string;
	gameState: gameStateProps | undefined;
	players: playerProps[];
	currentTrack?: musicItemsProps;
	/**
	 * Same box, tighter. Set on mobile, where it has to fit above the album
	 * art, and on desktop while the settings panel is expanded above it.
	 */
	compact?: boolean;
	/**
	 * The desktop column and the mobile stack both mount an instance (one is
	 * CSS-hidden), so each call site needs its own id.
	 */
	inputId?: string;
}

export default function LobbyQuestionBox({
	className = "",
	question,
	answerAction,
	currentPlayer,
	gameState,
	players,
	currentTrack,
	compact = false,
	inputId = "lobby-question-answer",
}: LobbyQuestionBoxProps) {
	const [answer, setAnswer] = useState("");
	const [pending, setPending] = useState(false);

	// Clears the locally-typed draft when a new round begins — during render,
	// not in an effect. The lock itself (`hasAnswered`, below) is driven by
	// server data rather than this comparison, since `round` can repeat (e.g.
	// replaying a one-round game always starts back at round 0) and a
	// dependency that never changes would leave the box permanently locked.
	const [lastRound, setLastRound] = useState(gameState?.round);
	if (gameState?.round !== lastRound) {
		setLastRound(gameState?.round);
		setAnswer("");
	}

	if (!gameState) return null;

	// Locking off the player's own row (not local-only state) means both
	// mounted copies of this component (desktop + compact, see CLAUDE.md)
	// agree on whether this round is already answered, and the lock always
	// clears the moment the round-start write clears `answer` server-side —
	// it can't get stuck the way a round-number comparison can.
	const hasAnswered = Boolean(
		players.find((player) => player.id === currentPlayer)?.answer,
	);
	const locked = hasAnswered || pending;

	async function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!answer.trim() || locked) return;

		setPending(true);
		try {
			await answerAction(answer, currentPlayer);
		} catch {
			showToast("Impossible d'envoyer ta réponse, réessaie.", "error");
		} finally {
			setPending(false);
		}
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		setAnswer(e.target.value);
	}

	if (
		gameState.status === GameStatus.Playing ||
		gameState.status === GameStatus.Paused
	) {
		return (
			<div
				className={`flex w-full shrink max-w-md flex-col glass-panel ${compact ? "p-4!" : ""} ${className}`}
			>
				<span
					className={`flex items-center text-lavender/80 ${compact ? "mb-3 gap-3" : "mb-4 gap-4"}`}
				>
					<IconChat />
					<h2
						id={`${inputId}-label`}
						className={`font-display font-bold ${compact ? "text-base" : "text-lg"}`}
					>
						{question}
					</h2>
				</span>

				<form
					className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}
					onSubmit={handleSubmit}
				>
					<input
						id={inputId}
						name={inputId}
						type='text'
						value={answer}
						onChange={handleChange}
						disabled={locked}
						aria-labelledby={`${inputId}-label`}
						aria-describedby={locked ? `${inputId}-status` : undefined}
						maxLength={80}
						placeholder='Écris ta réponse ici...'
						className={`field-input px-4 disabled:cursor-not-allowed disabled:border-lavender/14 disabled:opacity-60 ${
							compact ? "py-2.5 text-sm" : "py-3.5 text-[0.95rem]"
						}`}
					/>

					<PrimaryButton
						type='submit'
						className={`w-full ${compact ? "py-2.5!" : ""}`}
						disabled={locked || !answer.trim()}
					>
						<IconSend />
						{locked ? "Envoyé !" : "Envoyer"}
					</PrimaryButton>

					<p
						id={`${inputId}-status`}
						role='status'
						aria-live='polite'
						className={`text-center text-lavender/60 ${compact ? "text-xs" : "text-sm"} ${locked ? "" : "sr-only"}`}
					>
						Ta réponse est verrouillée jusqu'à la prochaine manche.
					</p>
				</form>
			</div>
		);
	} else if (gameState.status === GameStatus.Finished) {
		return (
			<LobbyAnswerBox
				className={className}
				players={players}
				currentTrack={currentTrack}
				questionMode={gameState.questionMode ?? gameState.mode}
				currentPlayerId={currentPlayer}
				compact={compact}
			/>
		);
	}
}
