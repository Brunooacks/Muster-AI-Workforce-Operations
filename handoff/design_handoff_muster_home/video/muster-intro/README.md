# Muster · vídeo de 53s — composição HyperFrames

`index.html` segue o contrato do HyperFrames: `#stage` com `data-composition-id`, cenas como `.clip` com `data-start`/`data-duration`, timeline GSAP pausada registrada em `window.__timelines.muster`.

## Renderizar

```bash
cd video/muster-intro
npx hyperframes preview   # preview com live reload
npx hyperframes render    # gera o MP4 (1920x1080)
```

Requisitos: Node 22+, FFmpeg.

## Roteiro (53s) — telas reais do produto (docs/screenshots)

| t | cena |
| --- | --- |
| 0–5 | Abertura: "Sua empresa já roda agentes de IA. Quantos? Fazendo o quê? Quem responde?" |
| 5–12 | Cada fornecedor cuida dos seus · o Muster cuida de todos os 47 |
| 12–18 | Visão geral: frota, decisões pendentes, alertas |
| 11–18 | Carteira de Trabalho: deve/não deve, responsabilidade, autonomia |
| 18–25 | Detector de vitória ilusória: "Volume sobe, conversão real cai" |
| 25–31 | Agentes: vereditos promover/mentorar/aposentar |
| 31–36 | Jornadas A2A: vários agentes, um SLA |
| 36–40 | Ligar telemetria: 3 passos |
| 40–46 | Logo + tese + CTA |

As telas vêm de `docs/screenshots/` do repositório. Para atualizar, basta trocar os PNGs (mesma proporção 16:10).

## Próximos passos

- Música e locução: `npx hyperframes skills update` e usar `/media-use` no agente.
- Transições do catálogo: `npx hyperframes add flash-through-white`.
- Números são ilustrativos; trocar por dados reais antes de publicar.
