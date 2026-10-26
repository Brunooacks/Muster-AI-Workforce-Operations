/**
 * Vídeo da home. Para trocar pelo vídeo novo, substitua os três arquivos em
 * public/video/ (mesmos nomes) ou aponte os caminhos abaixo para os novos, e
 * ajuste `duration` e `chapters` se o roteiro mudar. Nada mais precisa mudar.
 *
 * Origem atual: composição HyperFrames do handoff da home
 * (design_handoff_muster_home/video/muster-intro), renderizada 960x540, 24 fps.
 */
export const homeVideo = {
  webm: "/video/muster-intro.webm",
  mp4: "/video/muster-intro.mp4",
  poster: "/video/muster-intro-poster.jpg",
  duration: 53,
  /** Capítulos (segundos) — viram os atalhos abaixo do vídeo. */
  chapters: [
    { at: 0, label: { pt: "Abertura", en: "Opening", es: "Apertura" } },
    { at: 5, label: { pt: "Todas as plataformas", en: "Every platform", es: "Todas las plataformas" } },
    { at: 12, label: { pt: "Visão geral", en: "Overview", es: "Visión general" } },
    { at: 18, label: { pt: "Objetivos e KPIs", en: "Goals and KPIs", es: "Objetivos y KPIs" } },
    { at: 25, label: { pt: "Alerta", en: "Alert", es: "Alerta" } },
    { at: 32, label: { pt: "Decisões", en: "Decisions", es: "Decisiones" } },
    { at: 47, label: { pt: "Começar", en: "Get started", es: "Empezar" } },
  ],
} as const;
