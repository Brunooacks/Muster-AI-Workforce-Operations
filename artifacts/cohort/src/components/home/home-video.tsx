import { useEffect, useRef, useState } from "react";
import { useLang, type Lang } from "@/lib/i18n";
import { homeVideo } from "@/config/home-video";

const copy: Record<Lang, { watch: string; pause: string; sound: string; mute: string; caption: string; label: string }> = {
  pt: { watch: "Assistir", pause: "Pausar", sound: "Ativar som", mute: "Sem som", caption: `${homeVideo.duration} segundos · clique em um capítulo para pular · telas do produto`, label: "Vídeo: como o Muster funciona" },
  en: { watch: "Watch", pause: "Pause", sound: "Sound on", mute: "Mute", caption: `${homeVideo.duration} seconds · click a chapter to jump · product screens`, label: "Video: how Muster works" },
  es: { watch: "Ver", pause: "Pausar", sound: "Activar sonido", mute: "Sin sonido", caption: `${homeVideo.duration} segundos · haz clic en un capítulo para saltar · pantallas del producto`, label: "Video: cómo funciona Muster" },
};

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const url = (p: string) => `${base}${p}`;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function HomeVideo() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const reduced = useRef(prefersReducedMotion());

  // Carrega só quando o bloco chega perto da tela.
  useEffect(() => {
    const el = wrap.current;
    if (!el || !("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const v = video.current;
        if (e.isIntersecting) {
          setNear(true);
          if (v && !reduced.current && v.paused && v.dataset.userPaused !== "1") v.play().catch(() => {});
        } else if (v && !v.paused) {
          v.pause();
        }
      }
    }, { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Ao entrar as fontes, recarrega e (sem movimento reduzido) começa mudo.
  useEffect(() => {
    const v = video.current; if (!near || !v) return;
    v.load();
    if (!reduced.current) v.play().catch(() => {});
  }, [near]);

  const toggle = () => {
    const v = video.current; if (!v) return;
    if (v.paused) { v.dataset.userPaused = "0"; v.play().catch(() => {}); }
    else { v.dataset.userPaused = "1"; v.pause(); }
  };
  const jump = (at: number) => {
    const v = video.current; if (!v) return;
    v.currentTime = at; v.dataset.userPaused = "0"; v.play().catch(() => {});
  };
  const current = [...homeVideo.chapters].reverse().find((c) => time >= c.at)?.at ?? 0;

  return (
    <section aria-label={t.label} className="mx-auto w-full max-w-[1280px] px-5 pt-14 lg:px-12">
      <div
        ref={wrap}
        className="group relative mx-auto aspect-video w-full max-w-[1152px] overflow-hidden rounded-[22px] border border-white/10 bg-[#06080d] shadow-[0_40px_90px_-30px_rgba(0,0,0,.55),0_0_0_1px_rgba(0,0,0,.04)]"
      >
        <video
          ref={video}
          className="absolute inset-0 h-full w-full object-cover"
          poster={url(homeVideo.poster)}
          muted={muted}
          loop
          playsInline
          preload={near ? "metadata" : "none"}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          aria-label={t.label}
        >
          {near && <source src={url(homeVideo.webm)} type="video/webm" />}
          {near && <source src={url(homeVideo.mp4)} type="video/mp4" />}
        </video>
        {/* moldura do produto: brilho de borda e vinheta discretos */}
        <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/10 home-video-glow" />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t.pause : t.watch}
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${playing ? "opacity-0 hover:opacity-100 focus-visible:opacity-100" : "opacity-100"}`}
        >
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-[#06080d] shadow-[0_10px_40px_rgba(0,0,0,.45)] transition-transform group-hover:scale-105">
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
            )}
          </span>
        </button>
        {playing && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/70"
          >
            {muted ? t.sound : t.mute}
          </button>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${(time / homeVideo.duration) * 100}%` }} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={toggle} className="rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background">
          {playing ? `❚❚ ${t.pause}` : `▶ ${t.watch}`}
        </button>
        {homeVideo.chapters.map((c) => (
          <button
            key={c.at}
            type="button"
            onClick={() => jump(c.at)}
            aria-current={playing && current === c.at ? "true" : undefined}
            className={`rounded-full border px-4 py-2 text-[13px] transition-colors ${playing && current === c.at ? "border-foreground/40 bg-secondary text-foreground" : "border-border text-foreground/80 hover:bg-secondary"}`}
          >
            {c.label[lang] ?? c.label.pt}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t.caption}</p>
    </section>
  );
}
