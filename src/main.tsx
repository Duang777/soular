import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Scene } from "./Scene";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Scene />
  </StrictMode>,
);
