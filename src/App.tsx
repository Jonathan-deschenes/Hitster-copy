import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import CreateGame from "./pages/CreateGame";
import JoinGame from "./pages/JoinGame";
import Game from "./pages/Game";
import SpotifyCallback from "./pages/SpotifyCallback";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateGame />} />
      <Route path="/join" element={<JoinGame />} />
      <Route path="/game/:code" element={<Game />} />
      <Route path="/spotify/callback" element={<SpotifyCallback />} />
    </Routes>
  );
}
