import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Game from "./pages/Game";
import SpotifyCallback from "./pages/SpotifyCallback";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<Home initialTab="create" />} />
      <Route path="/join" element={<Home initialTab="join" />} />
      <Route path="/game/:code" element={<Game />} />
      <Route path="/spotify/callback" element={<SpotifyCallback />} />
    </Routes>
  );
}
