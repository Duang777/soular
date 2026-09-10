import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CASTS } from "./cast";
import { WaveStage } from "./WaveStage";

export function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const cast = event.data?.cast;
      if (event.data?.type !== "wave-open" || typeof cast !== "string") return;
      if (!CASTS.some((item) => item.key === cast)) return;
      navigate(`/shelf/${cast}`);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return <WaveStage />;
}
