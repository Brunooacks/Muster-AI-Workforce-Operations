---
name: Cohort product & design
description: Cohort = AI agent fleet governance platform; domain, design direction, conventions
---
- **Product:** plug-and-play platform giving AI agents identity, commitments, performance analysis, fleet governance. Core loop: Admissão → Avaliação (5-layer KPI: efficacy/efficiency/adoption/governance/value) → Veredito (Promover/Mentorar/Aposentar). Plus "Illusory Victory Detector" (alerts on contradictory KPI patterns e.g. ROI↑ + accuracy↓).
- **Auth:** Clerk (Replit-managed tenant). User explicitly wants NO Replit-coupling at code level for portability — Clerk code is portable (swap keys to migrate). PRD itself lists Clerk/WorkOS/Auth0.
- **Design direction (user-chosen):** "Neutro Notion" — warm paper/neutral background, monochrome with one gentle accent, super clean & accessible. User rejected the PRD's dark-amber "command room" as too aggressive. Respond to user in Portuguese.
- **Vocabulary (PT):** Veredito, Frota, Carteira de Trabalho (agent identity), Comitê, Admissão. Avoid: insight/stack/profile/onboarding.
- **Connectors:** simulated for the prototype; architecture must allow plugging a real connector later (user wants this as a fast follow-up once they provide a credential).
- **Fleet is shared org-wide by design** — NO per-tenant scoping; all authenticated users see the same fleet. Architect flagged tenant-scoping; left out deliberately. Don't "fix" it without asking.
- **`zod/v4` is not resolvable from api-server** (no direct zod dep; `@workspace/api-zod` re-exports the v3 namespace). Duck-type ZodError (`err.name === "ZodError"` + `Array.isArray(err.issues)`) instead of importing it.
- **`drizzle-kit push` is interactive** and fails without a TTY when adding a constraint to a populated column — even `--force` prompts to truncate. Apply the SQL directly using the name Drizzle expects (e.g. `agents_external_id_unique`) so future pushes stay in sync.
