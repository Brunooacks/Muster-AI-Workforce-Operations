# Jornadas A2A

Jornadas A2A são a unidade operacional acima do agente isolado. Cada jornada liga um propósito de negócio a um time misto, uma frota de agentes, responsabilidades ordenadas, modos de decisão, guardrails e contratos de handoff.

## Modelo operacional

- `journeys`: resultado, critérios de entrada/sucesso, SLA, owner e estado operacional.
- `journey_steps`: participante, responsabilidade, ordem, duração esperada, modo de decisão e guardrails.
- `journey_handoffs`: origem, destino, protocolo, condição e contexto obrigatório.
- `journey_events`: run, etapa, agente, decisão, duração, custo, sucesso e metadados auditáveis.
- `journey_recommendations`: recomendação, risco, SLA de decisão, aprovação/rejeição e próximo review.
- `journey_recommendation_actions`: desdobramento por Muster, agente externo e humano, com autonomia, owner, prazo, estado e evidência.
- `GET /api/journeys/:id/monitoring`: conclusão E2E, runs ativos, p95, custo, handoffs, gargalo, desempenho por etapa e detector de vitória ilusória.

## Fluxo de configuração

1. Crie ou selecione um propósito e um time em `/equipes`.
2. Crie a jornada em `/jornadas`.
3. Adicione etapas de agente, pessoa ou sistema.
4. Defina o modo de decisão: `autonomous`, `human-approval` ou `committee`.
5. Conecte etapas com handoffs e contexto obrigatório.
6. Ative a jornada e envie eventos de execução.

Ao adicionar uma etapa pela interface, um agente ainda não associado é incluído no time automaticamente como participante de suporte. A API exige que todo agente de etapa tenha uma atribuição ativa no time.

## Contrato de eventos

Endpoint:

```text
POST /api/journeys/{journeyId}/events
```

Exemplo de etapa concluída:

```json
{
  "externalEventId": "zendesk:ticket-928:decision-completed",
  "runId": "ticket-928",
  "stepId": "step-decision-id",
  "agentId": "agent-julia-id",
  "kind": "step_completed",
  "ts": "2026-08-14T13:20:10.000Z",
  "durationMs": 65000,
  "costCents": 24,
  "success": true,
  "metadata": {
    "source": "salesforce-agentforce",
    "confidence": 0.87,
    "decision": "route_to_resolution"
  }
}
```

Tipos aceitos:

- `journey_started`
- `step_started`
- `step_completed`
- `step_failed`
- `handoff`
- `decision`
- `journey_completed`
- `journey_failed`

`externalEventId` torna a ingestão idempotente por jornada. Referências a etapas e agentes são rejeitadas quando não pertencem à jornada.

## KPIs calculados

- Taxa de conclusão end-to-end.
- Runs ativos, concluídos e falhos.
- Tempo médio e p95 da jornada.
- Custo total e médio por run.
- Taxa global e por origem dos handoffs.
- Sucesso, latência e custo por etapa/agente.
- Gargalo pela maior duração média observada.
- Vitória ilusória quando o sucesso local é alto, mas a conclusão E2E ou o handoff degrada.

## Validação local

```bash
# Testes unitários do motor de monitoramento
pnpm --filter @workspace/api-server test -- --run src/lib/journey-monitoring.test.ts

# Gauntlet isolado: cria e remove toda a massa de teste
MUSTER_BASE_URL=http://localhost:8087 pnpm --filter @workspace/scripts run e2e:journey

# Demonstração persistente com Sofia, Júlia e Diego
MUSTER_BASE_URL=http://localhost:8087 pnpm --filter @workspace/scripts run seed:a2a-demo
```

O seed demonstrativo usa eventos sintéticos e declara essa origem nos metadados. Ele não deve ser interpretado como evidência de produção.

## Recomendações operacionais

O monitor da jornada pode ser convertido em um plano executável:

```text
POST /api/journeys/{journeyId}/recommendations/generate
```

A recomendação nasce como `pending` e explicita risco, impacto esperado e SLA para decisão. A aprovação exige responsável e justificativa:

```json
{
  "decision": "approved",
  "decidedBy": "Owner da jornada",
  "reason": "Gargalo confirmado e alteração limitada a uma amostra controlada."
}
```

Depois da aprovação:

- O Muster executa apenas capacidades internas declaradas como `autonomous`, como agendar a próxima revisão.
- Agentes externos recebem ações `supervised`; o runtime externo continua responsável por aplicar o ajuste e devolver evidência.
- Humanos recebem ações `human-only` para aceitar risco, revisar guardrails e validar o impacto.
- Cada ação recebe `dueAt`, estado operacional e resultado auditável.
- Uma ação bloqueada muda a recomendação para `blocked`; ao retomar, o plano volta a ser executável.
- A recomendação só chega a `completed` quando todas as ações aprovadas terminam.

Na rejeição, `rejectionDisposition` é obrigatório:

- `revise`: devolver para reformulação com nova evidência.
- `close`: encerrar sem execução.
- `escalate`: encaminhar à governança ou autoridade superior.

Todas as ações propostas são canceladas na rejeição. Eventos de decisão e transição permanecem auditáveis, mas são excluídos dos KPIs de runs para não contaminar conclusão, latência, handoff ou custo operacional.
