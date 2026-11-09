# Fórmula · camada 1 (custo por resultado validado) · `calc_version = cunha-1`

Status: para revisão do Arquiteto SaaS (C4.1). Código:
`artifacts/api-server/src/lib/value/cost-per-validated-task.ts` (base: PR #44,
MUS-171) e `artifacts/api-server/src/lib/outcome-layers.ts`. A calculadora
pública deve mostrar esta mesma fórmula.

## Unidade e escopo

- Unidade = **tarefa** (`task_id`, header `x-veltrix-task`). Uma tarefa tem uma
  ou mais tentativas (`run_id` + `attempt`); o custo soma **todas**.
- Só entram eventos **com `task_id`** (D-C4), do projeto do agente, em produção
  (ambiente `prod` ou sem ambiente; sandbox fica fora), no período fechado
  `[início, fim]` em UTC. Heartbeat não é trabalho.
- Cobertura por agente = eventos com `task_id` ÷ eventos do período (sem
  heartbeat). Aparece na página do agente ao lado do custo.

## Tarefa aceita (D-C3)

Por tarefa, em ordem de `ts`:

1. A última decisão **humana** vale: `human_review` com `success = 1` (ou
   evento com `accepted_by_kind = 'human'`) aceita; `human_review` com
   `success = 0` rejeita.
2. Sem decisão humana, vale o aceite `auto` — que só existe com
   `accepted_rule_version` (CHECK no banco).
3. Aceite `auto` **não conta** se o contrato vigente tem
   `require_human_accept = true` (aparece como `auto_not_counted`).

## Custo

```
tokens       = Σ cost_cents de todas as tentativas (execution/error) de todas as tarefas
revisão      = Σ human_minutes dos human_review × custo-hora ÷ 60
retrabalho   = Σ human_minutes dos demais eventos da tarefa × custo-hora ÷ 60
fora_fatura  = Σ custos fora da fatura alocados ao agente no período
custo_total  = tokens + revisão + retrabalho + fora_fatura

custo por resultado validado = custo_total ÷ tarefas aceitas
```

- Tarefa rejeitada ou sem aceite entra no custo e **nunca** no denominador.
- O custo de máquina do retrabalho já está em `tokens` (cada rodada vira uma
  tentativa nova); `retrabalho` é só o tempo humano. A decomposição "retry"
  abaixo mostra a fatia das tentativas > 1 sem somar de novo.
- **Custo-hora**: `role_rates` da conta, papel = `agents.role`, área do agente
  vence a linha da conta, vigente no último dia do período. Sem linha vigente →
  **indisponível** (`missing_hourly_rate`); não há default (R4).
- **Fora da fatura**: cada custo que cruza o período entra pró-rata pelos dias
  de sobreposição; `agent` → 100% do agente; `project` (ou `per_task` com
  projeto) → × tarefas do agente ÷ tarefas do projeto no período; `per_task`
  sem projeto → × tarefas do agente ÷ tarefas da conta.
- Moeda de saída BRL. Valor em USD exige câmbio informado; sem câmbio →
  **indisponível** (`missing_fx_rate`). Arredondamento ao centavo mais próximo
  em cada conversão e divisão (como no PR #44).

## Comparação humana (D-C2)

```
custo humano por tarefa = reference_human_minutes (contrato vigente) × custo-hora ÷ 60
economia por tarefa     = custo humano por tarefa − custo por resultado validado
economia %              = economia ÷ custo humano × 100
```

`human_minutes` do evento é revisão/retrabalho **real** e nunca substitui a
referência. Sem `reference_human_minutes` não há comparação (`null`).

## Decomposição

- **retry**: Σ custo das tentativas com `attempt > 1`, fatia sobre `tokens` e
  número de tarefas com mais de uma tentativa.
- **contexto**: Σ `context_tokens` ÷ Σ `tokens_in` (só tentativas com os dois).
- **modelo superdimensionado** (D-C1): modelo de referência = o fixado no
  contrato (`reference_model`) ou, por padrão, o mais barato da tabela de
  preços da Veltrix que atenda às capabilities usadas (tools, visão, janela de
  contexto máxima) **e** já tenha batido a meta de qualidade do contrato daquele
  agente — hoje, taxa de aceite das tarefas cuja última tentativa usou o modelo
  ≥ meta de um contrato `acceptance_rate`. Excesso = Σ max(0, custo da
  tentativa − tokens × preço do modelo de referência). Sem tabela de preços
  (decisão em aberto 1) → `missing_price_table`; sem meta de qualidade →
  `quality_goal_not_defined`; nenhum modelo qualificado → `no_qualified_model`.

## Indisponível

| motivo | quando |
|---|---|
| `no_tasks` | nenhum evento com `task_id` no período |
| `missing_hourly_rate` | sem custo-hora vigente para o papel/área |
| `no_accepted_tasks` | nenhuma tarefa aceita (pelas regras acima) |
| `missing_fx_rate` | há valor em USD e nenhum câmbio informado |

## Camada 2 e sinais (mesmo `calc_version`)

- taxa de aceite = aceitas ÷ tarefas; intervenção = tarefas com revisão humana,
  minutos de retrabalho ou `rework_count > 0` ÷ tarefas; parcela auto = aceites
  auto que contam ÷ aceitas; esperado × obtido = tarefas cuja última tentativa
  tem `actual` igual a `expected` ÷ tarefas com os dois.
- Contra o contrato vigente quando `metric_key ∈ {acceptance_rate,
  intervention_rate, expected_match_rate, cost_per_validated_task}`: valor,
  baseline, meta, `onTarget` e avanço 0–1 do baseline até a meta.
- Sinais: adoção (tarefas e dias ativos), Vitória Ilusória (última tentativa
  com sucesso técnico e tarefa não aceita), anomalia de tokens (tarefas com
  tokens > 3 × mediana; exige ≥ 5 tarefas).
- A camada legada `value` da avaliação deixou de ter `score: 50`: só existe
  quando há custo por resultado validado e o contrato tem meta nele (score =
  avanço × 100); senão é omitida.

## Golden (C4.3)

`specs/004-cunha/golden.csv`, conferido por `outcome-layers.golden.test.ts`:

- **ag_golden_a** (R$ 60/h, ref. 20 min): tokens 30+45+25+40+20 = 160;
  revisão (6+3+1) min = 1000; retrabalho 2 min = 200; fora da fatura 500;
  total 1860 ÷ 3 aceitas (a1 humano, a2 auto v1, a4 humano; a3 rejeitada) =
  620; humano 20 min = 2000; economia 1380 (69%); retry = 45.
- **ag_golden_b** (R$ 90/h, ref. 30 min, exige aceite humano): tokens
  100+50+60+70+80 = 360; revisão 4 min = 600; total 960 ÷ 2 aceitas (b1 auto
  não conta) = 480; humano 4500; economia 4020 (89,33%); retry 60+70 = 130.
- **ag_golden_c** (sem custo-hora): camada 1 indisponível
  (`missing_hourly_rate`); camada 2 calculada (aceite 50%, auto 100%).

## Snapshot (C4.4)

`outcome_snapshots` guarda `inputs` (tarefas normalizadas, cobertura, contrato,
custo-hora, custos alocados, tabela de preços, câmbio). `inputs_hash` =
SHA-256 do JSON com chaves ordenadas; o mesmo período com os mesmos dados dá o
mesmo hash. `computeOutcome(inputs)` reproduz as camadas sem ler outra tabela.
