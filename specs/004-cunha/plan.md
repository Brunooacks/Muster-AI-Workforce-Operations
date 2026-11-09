# Plan · 004 cunha

Base: `~/.veltrix-tmp/planos/cunha-tasks.md` (aprovado com D-C1..D-C6 em 24/10).
Ordem: item 1 → itens 2 e 3 → item 4 → item 12 → item 14. Um commit por item.

## Abordagem

1. **Item 1 · resultado no evento (MUS-174).** Migração 0023 aditiva em
   `agent_events` (todas anuláveis + backfill de conta/projeto/ambiente pelo
   agente, ambiente histórico = prod, trigger de compatibilidade como na 0022).
   O ingest valida a cadeia `taskId → runId → attempt → retryOf` (422), tira o
   tenant da credencial, grava `human_review` e aceite `auto` na trilha do
   outbox. O SDK ganha `startTask`/`retry`/`review`/`accept` com os nomes do
   Veltrix. `toEnvelope` prova a paridade com o envelope da E3.
2. **Item 2 · contrato versionado (MUS-175).** 0024 com `agent_contracts`
   imutável por trigger e `verdicts.contract_id/contract_version`. Rotas
   `GET/POST /agents/:id/contracts`; formulário no agent-detail substitui as
   strings do business case (que viram texto de referência).
3. **Item 3 · custo-hora e fora da fatura (MUS-176).** 0025 com `role_rates` e
   `off_invoice_costs`, sem seed. Rotas `/rates/*` só para admin, trilha no
   outbox, valores fora dos logs. Tela em Configurações.
4. **Item 4 · camada 1 (MUS-177).** Reaproveita a função pura do PR #44
   (`lib/value/cost-per-validated-task.ts`, MUS-171) e a ajusta: tarefas
   agrupadas por `task_id` somando todas as tentativas, aceite human/auto com
   versão da regra, custo-hora de `role_rates`, custos fora da fatura alocados.
   `outcome-layers.ts` monta camadas 1–2, sinais e cobertura; a camada `value`
   deixa de ter `score: 50`. 0026 com `outcome_snapshots` imutável e função de
   fechamento por período. Golden test com planilha.
5. **Item 12 · página do agente (MUS-178).** `GET /agents/:id/outcome?period=`
   e redesenho do agent-detail em Custo / Qualidade / Prova + faixa de sinais.
6. **Item 14 · landing (MUS-179).** Números de exemplo saem do JSX para
   `landing-examples.ts` com selo "Exemplo" (pt/en/es); varredura de termos
   da R6; `docs/fontes.md`.

## Riscos e mitigação

| risco | mitigação |
|---|---|
| INSERT antigo em `agent_events` sem conta/projeto (seed, scripts, conectores) | trigger preenche pelo agente; teste de integração com INSERT "do jeito antigo" |
| payload antigo mudar de resposta | teste compara o corpo byte a byte com o de antes |
| `human_review` disparar reavaliação desnecessária | dispatch próprio (sem reavaliar); a trilha vai ao outbox já `completed` |
| contrato editado depois do veredito | trigger de imutabilidade + veredito guarda a versão |
| DELETE do agente travar no trigger do contrato | o trigger só aceita DELETE quando o agente já não existe (cascata) |
| default de custo-hora "escondido" | nenhuma constante de custo-hora no código; teste de "indisponível" |
| tabela de preços da Veltrix ainda sem fonte (decisão em aberto 1) | entrada versionada do cálculo; sem tabela → modelo de referência "indisponível" |

## Verificação

- `make ci` (typecheck, unitários, build, down-guard, name-gate com termo
  sintético fora do repo).
- `make ci-integration` em Postgres 16 efêmero via docker: migrações 0023–0026,
  up → down → up com retrato igual, rotas novas, golden test.
- `drizzle-kit generate` sem mudanças depois de cada migração (sem drift).
