import { useState } from "react";
import type { lobbyRowProps } from "../types";

interface PublicLobbyTableProps {
	lobbies: lobbyRowProps[];
	selectedCode: string | null;
	onSelect: (row: lobbyRowProps) => void;
	loading: boolean;
}

export default function PublicLobbyTable({
	lobbies,
	selectedCode,
	onSelect,
	loading,
}: PublicLobbyTableProps) {
	const [search, setSearch] = useState("");

	const filtered = lobbies.filter((lobby) =>
		lobby.name.toLowerCase().includes(search.trim().toLowerCase()),
	);

	return (
		<div className="flex flex-col gap-3">
			<input
				type="text"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder="Rechercher une partie par nom"
				className="field-input px-4 py-3 text-[0.9rem]"
			/>

			<div className="max-h-[260px] overflow-y-auto overflow-x-auto rounded-xl border border-lavender/14">
				<table className="w-full min-w-[420px] border-collapse text-left text-[0.9rem]">
					<thead className="sticky top-0 z-10 bg-bg-deep">
						<tr className="border-b border-lavender/14 text-[0.78rem] text-lavender/44 uppercase">
							<th className="px-4 py-3 font-medium">Nom</th>
							<th className="px-4 py-3 font-medium">Catégorie</th>
							<th className="px-4 py-3 font-medium">Joueurs</th>
						</tr>
					</thead>
					<tbody>
						{loading && (
							<tr>
								<td
									colSpan={3}
									className="px-4 py-6 text-center text-lavender/44"
								>
									Chargement des parties publiques…
								</td>
							</tr>
						)}

						{!loading && filtered.length === 0 && (
							<tr>
								<td
									colSpan={3}
									className="px-4 py-6 text-center text-lavender/44"
								>
									Aucune partie publique pour le moment.
								</td>
							</tr>
						)}

						{!loading &&
							filtered.map((lobby) => {
								const isSelected = lobby.code === selectedCode;

								return (
									<tr
										key={lobby.id}
										onClick={() => onSelect(lobby)}
										className={`cursor-pointer border-b border-lavender/14 transition-colors last:border-b-0 hover:bg-purple/[0.1] ${
											isSelected ? "bg-purple/[0.14]" : ""
										}`}
									>
										<td
											className={`px-4 py-3 font-medium ${isSelected ? "text-accent-blue" : ""}`}
										>
											{lobby.name}
										</td>
										<td className="px-4 py-3 text-lavender/68">
											{lobby.category.label}
										</td>
										<td className="px-4 py-3 text-lavender/68">
											{lobby.players.length}
										</td>
									</tr>
								);
							})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
