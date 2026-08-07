import { useState, type FormEvent } from "react";
import { PrimaryButton } from "../Button";
import { IconChat, IconSend } from "../icons/GameIcons";
import { gameModeQuestions } from "../../constants/createGameOptions";
import type { GameModeEnum } from "../../types";

const DEFAULT_QUESTION = "Quelle est cette chanson ?";

interface LobbyQuestionBoxProps {
	className?: string;
	mode?: GameModeEnum;
}

export default function LobbyQuestionBox({
	className = "",
	mode,
}: LobbyQuestionBoxProps) {
	const [answer, setAnswer] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const question = (mode && gameModeQuestions[mode]) || DEFAULT_QUESTION;

	function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!answer.trim()) return;
		setSubmitted(true);
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		setAnswer(e.target.value);
		setSubmitted(false);
	}

	return (
		<div
			className={`flex w-full max-w-md flex-col rounded-3xl border border-lavender/14 bg-lavender/5 p-5 backdrop-blur-lg ${className}`}
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
					maxLength={80}
					placeholder='Écris ta réponse ici...'
					className='w-full rounded-xl border border-lavender/14 bg-bg-deep/55 px-4 py-3.5 text-[0.95rem] text-inherit transition-colors duration-200 placeholder:text-lavender/44 hover:border-lavender/28 focus:border-purple-soft focus:bg-purple/[0.08] focus:shadow-[0_0_0_3px_rgba(126,20,255,0.22)] focus:outline-none'
				/>

				<PrimaryButton
					type='submit'
					className='w-full'
					disabled={!answer.trim()}
				>
					<IconSend />
					{submitted ? "Envoyé !" : "Envoyer"}
				</PrimaryButton>
			</form>
		</div>
	);
}
