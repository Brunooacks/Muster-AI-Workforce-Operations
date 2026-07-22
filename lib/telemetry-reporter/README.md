# @workspace/telemetry-reporter

Conector de telemetria do Muster — o pacote que um **agente em execução** (ou o
processo que o hospeda) embute para reportar eventos de execução à plataforma.
O Muster **coleta e armazena**; ele não executa o agente nem serve métricas de
volta por este SDK.

- **Zero dependências** — usa `fetch` global (Node 18+, browsers, edge).
- **Fire-and-forget** — reportar telemetria nunca pode derrubar o agente:
  `report()` não lança; falhas resolvem `false` e vão para `onError`.
- **Timestamps opcionais** — agente ao vivo omite `ts` (servidor carimba
  "agora"); integrações batch/replay mandam o horário real da execução.

## Uso

```ts
import { createMusterReporter } from "@workspace/telemetry-reporter";

const reporter = createMusterReporter({
  baseUrl: "https://muster.example.com", // ou http://localhost:8080 em dev
  agentId: "<id do agente na frota>",
  token: process.env.MUSTER_TOKEN,       // dispensável com AUTH_DEV_BYPASS
});

// 1) Evento avulso
await reporter.report({
  kind: "execution",
  success: true,
  durationMs: 1240,
  costCents: 3,
  tokensIn: 1200,
  tokensOut: 480,
});

// 2) Envolvendo uma unidade de trabalho do agente (mede duração e
//    reporta sucesso/erro automaticamente; re-lança o erro)
const answer = await reporter.trackExecution(
  () => agent.handle(ticket),
  { enrich: (r) => ({ tokensOut: r.usage.outputTokens }) },
);

// 3) Backfill/batch (ex.: replay de histórico)
await reporter.reportMany(events); // → quantidade entregue
```

## Semântica dos eventos

| kind         | Significado                                            |
| ------------ | ------------------------------------------------------ |
| `execution`  | Unidade de trabalho concluída; `success` diz se resolveu certo. |
| `error`      | Falha/crash — o trabalho não foi concluído.            |
| `escalation` | O agente pediu ajuda humana (fora da alçada).          |
| `feedback`   | Sinal externo de qualidade (ex.: avaliação do usuário).|

Os eventos alimentam `agent_events` e derivam a avaliação em 5 camadas real
(`POST /agents/:id/reevaluate`). Para simular uma frota inteira em dev:

```bash
pnpm --filter @workspace/scripts run simulate-telemetry
```
