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
  token: process.env.MUSTER_AGENT_API_KEY, // obrigatório para o agente
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

## Tarefas, tentativas e aceite (0.1.0)

Para o custo por resultado validado, cada evento pode dizer de que **tarefa**
e de que **tentativa** ele é. Os nomes são os mesmos dos headers do Veltrix:
`taskId` = `x-veltrix-task`, `runId` = `x-veltrix-run`, `attempt` = ordinal do
run dentro da tarefa (1, 2, …) e `retryOf` = `runId` da tentativa anterior.

```ts
import { createMusterReporter, taskFromVeltrixHeaders } from "@workspace/telemetry-reporter";

// Atrás do gateway do Veltrix, reaproveite os ids que vieram nos headers.
const run = reporter.startTask(taskFromVeltrixHeaders(req.headers));

await run.trackExecution(() => agent.handle(ticket), {
  enrich: (r) => ({
    costCents: r.costCents,
    tokensIn: r.usage.input,
    contextTokens: r.usage.context, // parte de tokensIn que é contexto
    model: r.model,
    capabilities: { tools: true, vision: false, contextWindow: r.usage.input },
    expected: ticket.expected,
    actual: r.output,
  }),
});

// Não ficou bom: nova tentativa (attempt 2, retryOf = run.runId).
const second = run.retry();
await second.report({ kind: "execution", success: true, costCents: 5 });

// Revisão humana (aprovação/rejeição + minutos gastos)…
await second.review({ approved: true, minutes: 4, by: "ana@cliente.com" });
// …ou aceite automático, sempre com a versão da regra.
await second.accept({ by: "regra:schema-ok", kind: "auto", ruleVersion: "v3" });
```

Regras do servidor (422 quando violadas): `runId`/`attempt`/`retryOf` e o
aceite exigem `taskId`; `attempt > 1` exige `retryOf` apontando para um run da
mesma tarefa com `attempt` anterior; aceite `auto` exige `ruleVersion`. Cada
tentativa tem um único resultado `execution`/`error` (409 na repetição). Conta,
projeto e ambiente vêm da chave, nunca do corpo. Eventos sem `taskId` continuam
aceitos como antes, mas ficam fora do custo por resultado.

## Semântica dos eventos

| kind         | Significado                                            |
| ------------ | ------------------------------------------------------ |
| `execution`  | Unidade de trabalho concluída; `success` diz se resolveu certo. |
| `error`      | Falha/crash — o trabalho não foi concluído.            |
| `escalation` | O agente pediu ajuda humana (fora da alçada).          |
| `feedback`   | Sinal externo de qualidade (ex.: avaliação do usuário); também carrega o aceite de `run.accept`. |
| `human_review` | Aprovação/rejeição humana de uma tarefa, com minutos (`run.review`). |

Os eventos alimentam `agent_events` e derivam a avaliação em 5 camadas real
(`POST /agents/:id/reevaluate`). Para simular uma frota inteira em dev:

```bash
pnpm --filter @workspace/scripts run simulate-telemetry
```
