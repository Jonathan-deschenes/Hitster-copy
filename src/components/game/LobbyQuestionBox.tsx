import { useEffect, useState, type FormEvent } from "react";
import { PrimaryButton } from "../Button";
import { IconChat, IconSend } from "../icons/GameIcons";
import type { gameStateProps, musicItemsProps, playerProps } from "../../types";
import LobbyAnswerBox from "./LobbyAnswerBox";

interface LobbyQuestionBoxProps {
	className?: string;
	question: string;
	answerAction: (answer: string, playerId: string) => Promise<void>;
	currentPlayer: string;
	gameState: gameStateProps | undefined;
	players: playerProps[];
	currentTrack?: musicItemsProps;
}

export default function LobbyQuestionBox({
	className = "",
	question,
	answerAction,
	currentPlayer,
	gameState,
	players,
	currentTrack,
}: LobbyQuestionBoxProps) {
	const [answer, setAnswer] = useState("");
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		setAnswer("");
		setSubmitted(false);
	}, [gameState?.round]);

	if (!gameState) return null;

	async function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!answer.trim() || submitted) return;

		setSubmitted(true);
		try {
			await answerAction(answer, currentPlayer);
		} catch {
			setSubmitted(false);
		}
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		setAnswer(e.target.value);
	}

	if (gameState.status === "playing" || gameState.status === "paused") {
		return (
			<div
				className={`flex w-full max-w-md flex-col glass-panel ${className}`}
			>
				<span className='mb-4 flex items-center gap-4 text-lavender/80'>
					<IconChat />
					<h2 className='font-display text-lg font-bold'>{question}</h2>
				</span>

				<form className='flex flex-col gap-3' onSubmit={handleSubmit}>
					<input
						id='lobby-question-answer'
						name='lobby-question-answer'
						type='text'
						value={answer}
						onChange={handleChange}
						disabled={submitted}
						maxLength={80}
						placeholder='Écris ta réponse ici...'
						className='field-input px-4 py-3.5 text-[0.95rem] disabled:cursor-not-allowed disabled:border-lavender/14 disabled:opacity-60'
					/>

					<PrimaryButton
						type='submit'
						className='w-full'
						disabled={submitted || !answer.trim()}
					>
						<IconSend />
						{submitted ? "Envoyé !" : "Envoyer"}
					</PrimaryButton>

					{submitted && (
						<p className='text-center text-sm text-lavender/60'>
							Ta réponse est verrouillée jusqu'à la prochaine manche.
						</p>
					)}
				</form>
			</div>
		);
	} else if (gameState.status === "finished") {
		return (
			<LobbyAnswerBox
				className={className}
				players={players}
				currentTrack={currentTrack}
				questionMode={gameState.questionMode ?? gameState.mode}
				currentPlayerId={currentPlayer}
			/>
		);
	}
}
