import { useEffect, useState } from "react";

const CONSULTA = "(prefers-reduced-motion: reduce)";

/** true quando o sistema pede menos movimento: autoplay fica desligado. */
export function useReducedMotion(): boolean {
  const [reduzir, setReduzir] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(CONSULTA).matches === true,
  );
  useEffect(() => {
    const media = window.matchMedia?.(CONSULTA);
    if (!media) return;
    const mudou = () => setReduzir(media.matches);
    media.addEventListener("change", mudou);
    return () => media.removeEventListener("change", mudou);
  }, []);
  return reduzir;
}
