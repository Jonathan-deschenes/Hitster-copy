import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs-react";
import type { lobbyRowProps } from "../types";
import { findLobbyRowByCode, joinLobby } from "../lib/lobbies";
import {
	createLobbySessionToken,
	storeLobbySessionToken,
} from "../lib/lobbies/session";
import { usePlayerIdentity } from "./usePlayerIdentity";

export function useJoinGameForm() {
	const navigate = useNavigate();

	const { player, handlePseudoName } = usePlayerIdentity(false);

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

			const sessionToken = createLobbySessionToken();
			const lobby = await joinLobby(selectedLobbyRow, player, sessionToken);
			storeLobbySessionToken(lobby.generatedCode, player.id, sessionToken);
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
		handlePseudoName,
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
