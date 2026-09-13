import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./Home";
import { MatchRevealPage } from "./MatchReveal";
import { Nebula } from "./Nebula";
import { ShelfPage } from "./Shelf";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export function App() {
  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nebula" element={<Nebula />} />
        <Route path="/match" element={<MatchRevealPage />} />
        <Route path="/shelf/:cast" element={<ShelfPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
