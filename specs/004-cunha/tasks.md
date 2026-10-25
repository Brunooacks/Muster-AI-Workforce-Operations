# Tasks · 004 cunha

Formato Spec Kit. `[x]` = feito e commitado nesta branch (um commit por item).

## Item 1 · Campos de resultado em agent_events e no SDK (MUS-174)

- [x] **C1.1** Spec, plan, data-model, tasks e `contracts/agent-event.v2.json` em `specs/004-cunha/`
- [x] **C1.2** Migração 0023 `agent_events` no formato do envelope + down + teste up→down→up e backfill
- [x] **C1.3** Ingest e contrato da API (OpenAPI → api-zod; 422 de retry; tenant da credencial; `human_review` e aceite `auto` na trilha)
- [x] **C1.4** SDK `telemetry-reporter` 0.1.0: `startTask`, `retry`, `review`, `accept`, headers `x-veltrix-*`
- [x] **C1.5** `toEnvelope` (paridade com o envelope da E3) + teste de nomes `x-veltrix-*`

## Item 2 · Contrato numérico versionado por agente (MUS-175)

- [x] **C2.1** Migração 0024 `agent_contracts` + `verdicts.contract_id/version` + down
- [x] **C2.2** API `GET/POST /agents/:id/contracts` (POST só admin) e formulário no agent-detail
- [x] **C2.3** Veredito grava (trigger `verdicts_contract_trg`) e lê a versão do contrato

## Item 3 · Custo-hora e custos fora da fatura (MUS-176)

- [x] **C3.1** Migração 0025 `role_rates` e `off_invoice_costs` + down
- [x] **C3.2** Rotas `/rates/*` (admin), trilha no outbox, tela em Configurações → Custo-hora e custos

## Item 4 · Cálculo da camada 1 (MUS-177)

- [x] **C4.1** `formula.md`
- [x] **C4.2** `outcome-layers.ts` (camadas 1–2, sinais, cobertura) no lugar do `score: 50`
- [x] **C4.3** Golden test de 3 agentes + `golden.csv`
- [x] **C4.4** Migração 0026 `outcome_snapshots` + fechamento por período + down

## Item 12 · Página do agente nas três camadas (MUS-178)

- [ ] **C12.1** `GET /agents/:id/outcome?period=`
- [ ] **C12.2** agent-detail com Custo / Qualidade / Prova + sinais

## Item 14 · Landing sem números fixos (MUS-179)

- [ ] **C14.1** Números da landing em `landing-examples.ts` com selo "Exemplo"
- [ ] **C14.2** Termos da R6 fora dos textos públicos + `docs/fontes.md`

## Fechamento (fora desta rodada)

- [ ] **CZ.1** Ensaio em staging das migrações 0023–0026 (runbook; sem aplicar)
