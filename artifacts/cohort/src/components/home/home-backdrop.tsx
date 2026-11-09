/** Fundo da home: brilho ciano discreto + grade fina. Reutilizado no login. */
export function HomeBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="home-backdrop">
      <div className="home-video-glow absolute inset-0" />
      <div className="absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
      <div className="home-backdrop-grid absolute inset-0" />
    </div>
  );
}
