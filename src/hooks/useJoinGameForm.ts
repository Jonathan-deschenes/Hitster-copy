import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs-react";
import generateUniqueId from "generate-unique-id";
import type { lobbyRowProps, playerProps } from "../types";
import { findLobbyRowByCode, joinLobby } from "../lib/lobbies";
import { StorageKeys, StorageUtility } from "./useStorage";

export function useJoinGameForm() {
	const navigate = useNavigate();
	// Retrieve saved pseudo in localstorage
	const savedPseudo =
		StorageUtility.getItem<string>(StorageKeys.USER_NAME) ?? "";
	const [player, setPlayer] = useState<playerProps>({
		id: generateUniqueId(),
		pseudo: savedPseudo,
		host: false,
		score: 0,
		answer: "",
	});

	const [code, setCode] = useState("");
	const [isSearchingCode, setIsSearchingCode] = useState(false);

	const [selectedLobbyRow, setSelectedLobbyRow] =
		useState<lobbyRowProps | null>(null);
	const [password, setPassword] = useState("");

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function selectLobby(row: lobbyRowProps) {
		setError(null);
		setPassword("");
		setSelectedLobbyRow(row);
	}

	async function handleCodeSearch() {
		if (!code) return;

		setError(null);
		setIsSearchingCode(true);

		try {
			const row = await findLobbyRowByCode(code);
			if (!row) {
				setError("Aucun lobby ne correspond à ce code.");
				return;
			}
			selectLobby(row);
		} catch (err) {
			console.error(err);
			setError("Une erreur est survenue, réessaie.");
		} finally {
			setIsSearchingCode(false);
		}
	}

	async function handleJoin(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedLobbyRow) return;

		setError(null);
		setIsSubmitting(true);

		try {
			const passwordMatches = bcrypt.compareSync(
				password,
				selectedLobbyRow.password_hash,
			);
			if (!passwordMatches) {
				setError("Mot de passe incorrect.");
				return;
			}

			const lobby = await joinLobby(selectedLobbyRow, player);
			navigate(`/game/${lobby.generatedCode}?current=${player.id}`, {
				state: lobby,
			});
		} catch (err) {
			console.error(err);
			setError("Une erreur est survenue, réessaie.");
		} finally {
			setIsSubmitting(false);
		}
	}

	const canSearchCode = player.pseudo !== "" && code !== "" && !isSearchingCode;
	const canJoin =
		player.pseudo !== "" &&
		password !== "" &&
		selectedLobbyRow !== null &&
		!isSubmitting;

	return {
		player,
		setPlayer,
		code,
		setCode,
		isSearchingCode,
		selectedLobbyRow,
		password,
		setPassword,
		isSubmitting,
		error,
		selectLobby,
		handleCodeSearch,
		handleJoin,
		canSearchCode,
		canJoin,
	};
}
