import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  type Location,
} from "react-router-dom";
import { Home } from "./Home";
import { MatchRevealPage } from "./MatchReveal";
import { Nebula } from "./Nebula";
import { ShelfPage } from "./Shelf";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

function backgroundLocationFromState(state: unknown): Location | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const candidate = (state as { backgroundLocation?: unknown }).backgroundLocation;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  return (candidate as { pathname?: unknown }).pathname === "/nebula"
    ? candidate as Location
    : null;
}

function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = location.pathname.startsWith("/shelf/")
    ? backgroundLocationFromState(location.state)
    : null;

  return (
    <>
      <div
        className="route-layer"
        aria-hidden={backgroundLocation ? true : undefined}
        inert={backgroundLocation ? true : undefined}
      >
        <Routes location={backgroundLocation ?? location}>
          <Route path="/" element={<Home />} />
          <Route path="/nebula" element={<Nebula active={!backgroundLocation} />} />
          <Route path="/match" element={<MatchRevealPage />} />
          <Route path="/shelf/:cast" element={<ShelfPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {backgroundLocation && (
        <div className="route-overlay">
          <Routes location={location}>
            <Route path="/shelf/:cast" element={<ShelfPage />} />
          </Routes>
        </div>
      )}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}
