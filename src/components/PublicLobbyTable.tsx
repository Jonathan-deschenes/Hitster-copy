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
		<div className="flex flex-col gap-2.5 sm:gap-3">
			<input
				type="text"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder="Rechercher une partie par nom"
				className="field-input px-3.5 py-2.5 text-[0.85rem] sm:px-4 sm:py-3 sm:text-[0.9rem]"
			/>

			<div className="max-h-[180px] overflow-y-auto overflow-x-auto rounded-xl border border-lavender/14 sm:max-h-[260px]">
				<table className="w-full min-w-[420px] border-collapse text-left text-[0.85rem] sm:text-[0.9rem]">
					<thead className="sticky top-0 z-10 bg-bg-deep">
						<tr className="border-b border-lavender/14 text-[0.72rem] text-lavender/44 uppercase sm:text-[0.78rem]">
							<th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Nom</th>
							<th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Catégorie</th>
							<th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Joueurs</th>
						</tr>
					</thead>
					<tbody>
						{loading && (
							<tr>
								<td
									colSpan={3}
									className="px-3 py-5 text-center text-lavender/44 sm:px-4 sm:py-6"
								>
									Chargement des parties publiques…
								</td>
							</tr>
						)}

						{!loading && filtered.length === 0 && (
							<tr>
								<td
									colSpan={3}
									className="px-3 py-5 text-center text-lavender/44 sm:px-4 sm:py-6"
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
											className={`px-3 py-2.5 font-medium sm:px-4 sm:py-3 ${isSelected ? "text-accent-blue" : ""}`}
										>
											{lobby.name}
										</td>
										<td className="px-3 py-2.5 text-lavender/68 sm:px-4 sm:py-3">
											{lobby.category.label}
										</td>
										<td className="px-3 py-2.5 text-lavender/68 sm:px-4 sm:py-3">
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
