/**
 * Vídeo da home (v3), um arquivo por idioma com legendas embutidas.
 * Para trocar, substitua os arquivos em public/video/ (mesmos nomes) e ajuste
 * `duration` e `chapters` se o roteiro mudar.
 *
 * Origem: /workspace/muster/video-novo/v3 (edit.py), 1920x1080, 30 fps, sem áudio.
 */
type L3 = { pt: string; en: string; es: string };
const files = (lang: "pt" | "en" | "es") => ({
  webm: `/video/muster-home-${lang}.webm`,
  mp4: `/video/muster-home-${lang}.mp4`,
  poster: `/video/muster-home-${lang}-poster.jpg`,
});

export const homeVideo = {
  sources: { pt: files("pt"), en: files("en"), es: files("es") },
  /** O v3 não tem trilha de áudio: o botão de som fica oculto. */
  hasAudio: false as boolean,
  duration: 56,
  /** Capítulos (segundos) — viram os atalhos abaixo do vídeo. */
  chapters: [
    { at: 0, label: { pt: "Várias plataformas", en: "Many platforms", es: "Varias plataformas" } },
    { at: 15, label: { pt: "Visão geral", en: "Overview", es: "Visión general" } },
    { at: 25, label: { pt: "Ficha do agente", en: "Agent file", es: "Ficha del agente" } },
    { at: 34, label: { pt: "Pessoas e agentes", en: "People and agents", es: "Personas y agentes" } },
    { at: 45, label: { pt: "Decisões", en: "Decisions", es: "Decisiones" } },
  ] as Array<{ at: number; label: L3 }>,
};
