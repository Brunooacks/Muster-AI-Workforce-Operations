---
name: Unified light "Trincheira" theme (landing + app)
description: The marketing landing and the authenticated app share ONE light theme — history of why the earlier dark-landing split was dropped
---

# Single-surface visual strategy

Both the public landing (`artifacts/cohort/src/pages/landing.tsx`) and the authenticated
app use the **same light "Trincheira" theme**: warm-cream background (`42 30% 93%`),
forest-green primary (`158 27% 19%`), Spectral serif headlines, IBM Plex Mono for
eyebrows/numbers, status palette via `--chart-1..5` (sage/ochre/terracotta/red/blue).
The landing pulls all colors from the app's CSS tokens (`bg-background`, `text-foreground`,
`border-card-border`, `bg-primary`, `text-chart-1/2/3`, etc.) so the two surfaces stay
in lockstep.

**Why:** The landing was originally a bold/cinematic **dark** Veltrix-inspired surface
(near-black, animated aurora, coral `#e8744a`, Inter 800/900 + Instrument Serif) while
the app was light. The user found the dark-landing-vs-light-app contrast jarring
("não faz sentido, mantenha clean") and explicitly chose to make the landing light/clean
to match the app. This **supersedes** the prior deliberate dark-landing split.

**How to apply:**
- Do NOT reintroduce a dark landing or toggle the global `.dark` class. Keep the landing
  using app tokens so palette changes propagate from `index.css`.
- The hero accent is a serif italic gradient `from primary via chart-1 to chart-2` — not
  the old coral. Coral `#e8744a`, the aurora `@keyframes`/`.aurora-*` classes, and the
  `.font-display-serif` (Instrument Serif) helper were all removed from `index.css`.
- Headlines use `font-serif` (Spectral, max weight 700 — use `font-medium`/`font-semibold`,
  not `font-extrabold`). Eyebrows/labels/numbers use `font-mono` uppercase tracked.
