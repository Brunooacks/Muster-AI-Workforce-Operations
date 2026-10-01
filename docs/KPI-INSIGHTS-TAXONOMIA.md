# KPI & Insights — taxonomia operacional

## Objetivo

O Muster trata KPI como contrato operacional, não como um número isolado. Um indicador só pode sustentar uma decisão quando informa o que mede, de onde vem, quando vence, qual evidência aceita e quem responde pela ação.

O contrato vive em código e é exposto pela API. Nenhuma coluna ou migração adicional é necessária para adotar a taxonomia.

## Contrato mínimo

Cada KPI define:

- `domain` e `capability`: cenário de negócio e capacidade transversal.
- `formula`, `unit` e `direction`: cálculo, unidade e sentido de melhoria.
- `sourceSignals`: sinais necessários para produzir o indicador.
- `cadence` e `freshness`: frequência esperada e janelas até o dado ficar stale ou expirar.
- `minSampleSize`: amostra mínima antes de comparar ou recomendar.
- `confidence`: confiança mínima e nível `decision-grade`.
- `baseline` e `target`: política de comparação e resultado desejado.
- `owner`: responsável por qualidade, interpretação e ação.
- `decisionImpact`: efeito esperado no veredito de promoção, mentoria, retirada ou observação.
- `guardrail`: indicador que limita autonomia ou promoção, mesmo quando os demais resultados estão bons.
- `evidence`: tipos de evidência aceitos, confiança mínima e taxa de auditoria.

## Capacidades transversais

| Capacidade | Pergunta operacional |
| --- | --- |
| Resultado de negócio | O workload produz o outcome para o qual foi contratado? |
| Qualidade e avaliações | A saída é correta, fundamentada e calibrada com revisão humana? |
| Orquestração A2A | Handoffs preservam contexto e concluem a jornada? |
| Colaboração humano-agente | O agente reduz trabalho sem criar override ou retrabalho oculto? |
| Discovery e observabilidade | O Muster reconhece e instrumenta os sinais necessários? |
| Runtime e fallback | O workload permanece disponível e recupera falhas reais? |
| Qualidade de dados | Os eventos são frescos, completos, únicos e reconstruíveis? |

## Kits de adoção

Os kits evitam painéis vazios e métricas escolhidas por conveniência. Há um baseline de instrumentação e seis cenários: suporte, vendas, engenharia, risco, operações/backoffice e workforce híbrida.

1. **Baseline — Instrumentar:** sinais obrigatórios ativos, dados frescos e amostra mínima.
2. **Piloto — Validar:** baseline comparável, confiança mínima e nenhum guardrail crítico violado.
3. **Escala — Sustentar:** confiança `decision-grade`, resultado por duas janelas e owner definido.

Um time pode adicionar métricas específicas, mas não deve remover guardrails do kit sem registrar a decisão de governança.

## Score operacional

O score usa pesos explícitos: eficácia 25%, eficiência 15%, adoção 15%, governança 25% e valor 20%. O resultado recebe um modificador de evidência composto por frescor e confiança. Lacunas de camada reduzem a elegibilidade decisória; uma violação de guardrail limita o score a 49.

Faixas:

- `< 50`: crítico.
- `50–64,9`: em risco.
- `65–84,9`: controlado.
- `≥ 85`: excelente.

O score não substitui o drill-down. A resposta sempre preserva score base, modificador de evidência, cobertura e motivos.

## Frescor e confiança

Frescor possui cinco estados: `fresh`, `aging`, `stale`, `expired` e `missing`. Dados `stale`, expirados ou ausentes não podem sustentar promoção ou aumento de autonomia.

Confiança possui quatro bandas: `insufficient`, `indicative`, `reliable` e `decision-grade`. `Reliable` permite análise operacional; decisões de escala devem preferir `decision-grade`.

## Tendência, anomalia e prioridade

Tendência compara a primeira e a segunda metade da série, respeitando a direção do KPI. Mudanças acima de 3% indicam melhora ou degradação. Anomalias usam o z-score do último ponto contra o histórico, com corte absoluto de 2,5.

A prioridade combina severidade, impacto, confiança, frescor, volume afetado, guardrail e risco de SLA:

- `now`: agir em até 60 minutos.
- `next`: agir em até 24 horas.
- `watch`: acompanhar por até sete dias.

As recomendações são determinísticas e auditáveis; não dependem de LLM externo.

## APIs

- `GET /api/performance/kpi-contracts`
- `GET /api/performance/kpi-contracts/{domain}`
- `GET /api/performance/kpi-taxonomy`
- `GET /api/catalog/metric-kits`
- `GET /api/fleet/insights`

O OpenAPI descreve integralmente as respostas e gera os contratos TypeScript/Zod usados por API e frontend.
