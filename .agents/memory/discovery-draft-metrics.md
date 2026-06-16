---
name: Discovery draft metrics vs evaluation shape
description: Why AI-draft metric target/rationale are proposal-only and how 5-layer coverage is guaranteed at admission.
---

# Discovery draft metrics vs evaluation shape

The Admissão discovery flow produces `AgentDraft.proposedMetrics` with
`layer/label/unit/target/rationale`. These feed admission seeding, but the
seeded evaluation uses only `layer/label/unit` (+ a deterministic value).

**Why:** `KpiMetric` (the evaluation metric shape in the DB layer) has no
`target`/`rationale` fields — only `label/value/unit/trend/direction`. So a
draft metric's `target`/`rationale` are proposal metadata for the human
reviewer, not stored on the evaluation. Persisting them would require a schema
change and was intentionally left out of scope.

**How to apply:** If a future task needs goal-vs-actual on the evaluation,
extend `KpiMetric` (and the proposed-metric seeding) rather than assuming the
target already flows through.

## 5-layer coverage guarantee
Every draft and every admission-seeded evaluation must cover all 5 layers
(efficacy/efficiency/adoption/governance/value). This is enforced
deterministically via `DEFAULT_LAYER_METRIC` fallback fill at BOTH draft
generation and admission seeding — never trust the LLM (or the user's edits)
to include all layers.

**Why:** Cohort's whole model is the 5-layer evaluation; an agent admitted
with a partial metric set yields an incomplete evaluation. The model can omit
layers and the UI lets users delete metric rows, so the guarantee lives in code.
