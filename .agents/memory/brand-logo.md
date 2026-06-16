---
name: Cohort brand logo
description: The chosen logo direction, its meaning, and how assets are generated.
---
# Cohort logo — "Camadas Ascendentes"

Symbol = three ascending chevrons (sage → mid → forest), evoking layered 5-camada
evaluation + upward verdict (promote). Chosen by the user over "Convergência" (nodes)
and "Anel da Coorte" (three arcs). Supersedes the old "C in green square" and the
hexagon/layers `logo.svg`.

**In-app symbol** lives in `artifacts/cohort/src/components/logo.tsx` (`CohortMark`).
It is theme-aware: strokes use `hsl(var(--chart-1))` and `hsl(var(--primary))` so it
adapts to light/dark automatically. Used in landing header+footer and sidebar Wordmark.

**Reusable export assets** in `artifacts/cohort/public/brand/` (symbol / wordmark /
lockup, each `-on-light` and `-on-dark`, SVG + transparent high-res PNG) plus favicon.
The wordmark "Cohort" is **outlined to vector paths** (Spectral SemiBold) so assets are
font-independent.

**How to regenerate:** the generator is a throwaway script (opentype.js outlines the
wordmark, @resvg/resvg-js rasterizes transparent PNGs) — NOT committed to the repo, so
recreate it if you need to tweak geometry/colors. `public/favicon.svg` and
`public/logo.svg` (Clerk auth logo via App.tsx) are copies of the brand symbol/favicon.
