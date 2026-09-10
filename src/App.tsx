import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./Home";
import { ShelfPage } from "./Shelf";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export function App() {
  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shelf/:cast" element={<ShelfPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
