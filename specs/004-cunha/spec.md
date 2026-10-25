# Spec 004 · Cunha · custo por resultado validado

Status: rascunho para revisão do Arquiteto SaaS (cunha · C1.1).
Branch: `feat/cunha-mus-173` (empilhada sobre `feat/e1-tenant-projeto-ambiente`).
Origem: `~/.veltrix-tmp/planos/cunha-tasks.md` (decisões D-C1..D-C6 e regras
R1..R6 de 24/10). Linear: MUS-173 (épico) · MUS-174, 175, 176, 177, 178, 179.

## Contexto

Hoje o Muster mede o agente por evento solto: `agent_events` não sabe de que
tarefa, de que tentativa, nem se o resultado foi aceito. A camada "valor" da
avaliação é um `score: 50` fixo, o contrato do agente é texto livre
(`business_case.baseline/targetPayback/actualPayback`) e o custo humano não
existe. A cunha troca isso por três camadas calculadas a partir de tarefas:

1. **Custo por resultado validado** — tokens de todas as tentativas + retrabalho
   + revisão humana × custo-hora + custos fora da fatura, ÷ tarefas aceitas;
   comparado com o custo humano de referência do contrato.
2. **Qualidade** — esperado × obtido, intervenção humana e parcela de aceite
   automático, contra baseline e meta do contrato versionado.
3. **Prova** — proveniência de cada número, trilha (revisões humanas e aceites
   automáticos no outbox), cobertura de dono e credencial.

Mais uma faixa de **sinais** (adoção, Vitória Ilusória, anomalia de taxa de
tokens). O veredito manter/ajustar/aposentar é o próximo item do backlog e
aparece como "em breve".

## Glossário compartilhado com o Veltrix (R2)

| Muster (coluna) | API/SDK (camelCase) | Veltrix | Semântica |
|---|---|---|---|
| `task_id` | `taskId` | header `x-veltrix-task` | a unidade de trabalho que pode ser aceita |
| `run_id` | `runId` | header `x-veltrix-run` | uma execução (tentativa) da tarefa |
| `attempt` | `attempt` | — | ordinal do run dentro da task: 1, 2, … |
| `retry_of` | `retryOf` | — | `run_id` da tentativa anterior da mesma task |

Regra: `attempt = 1` sem `retryOf`; `attempt = n > 1` exige `retryOf` = run da
mesma task com `attempt = n − 1`. O envelope da E3 (`task-envelope`, T1.8) usa
os mesmos nomes (`task_id`, `attempt`) e `toEnvelope` (C1.5) garante a
paridade sem migração (R1).

## Histórias

1. **Como agente**, reporto cada execução com `taskId/runId/attempt` e, quando
   repito, digo de qual run é a nova tentativa; o Muster recusa (422) um retry
   que aponte para outra tarefa ou pule o ordinal.
2. **Como revisor humano** (ou o sistema do cliente em nome dele), registro
   aprovação ou rejeição de uma tarefa com os minutos gastos; isso entra na
   camada 2 (intervenção) e na trilha (camada 3) (R5).
3. **Como sistema de aceite automático**, aceito uma tarefa informando a regra
   e a versão da regra; sem versão o aceite é recusado (D-C3).
4. **Como admin da conta**, defino o contrato numérico do agente (métrica,
   baseline, meta, limite, prazo, dono, minutos humanos de referência, exigir
   aceite humano, modelo de referência). Cada mudança é uma versão nova; nada é
   editado (R3).
5. **Como admin da conta**, cadastro o custo-hora por área/papel e os custos
   fora da fatura (licença, infra, integração, outro) com vigência. Sem
   custo-hora a camada 1 diz "indisponível" — nunca usa um default (R4).
6. **Como dono do agente**, abro a página do agente e vejo as três camadas,
   cada número com status `ok`/`indisponível` e o motivo, a cobertura de
   tarefas e a regra/versão dos aceites automáticos.
7. **Como visitante da landing**, só vejo números de exemplo marcados como
   "Exemplo" e nenhum dado sem fonte pública (R6).

## Regras

- **R1** Envelope da E3 dentro de `agent_events`: as colunas novas são a fonte;
  a E3 só transporta.
- **R2** Nomes iguais aos headers `x-veltrix-*` (tabela acima).
- **R3** Contrato versionado e imutável; veredito grava `contract_id` e
  `contract_version` e é lido sempre contra a versão dele.
- **R4** Custo-hora por conta, sem seed e sem default global; ausência =
  "indisponível" com motivo.
- **R5** Aprovação humana = intervenção (camada 2) + trilha (camada 3).
- **R6** A frase atribuída ao Gartner e os números "1 em 5 projetos com ROI" e
  "uma tarefa pode custar 100x o previsto" não entram em texto público.
- **D-C1** Modelo de referência: o fixado no contrato ou, por padrão, o mais
  barato da tabela de preços da Veltrix que atenda às capabilities das tarefas
  e já tenha batido a meta de qualidade do contrato daquele agente; nenhum →
  "indisponível".
- **D-C2** `reference_human_minutes` (contrato) é a referência; o
  `human_minutes` do evento é revisão/retrabalho real. Nunca se misturam.
- **D-C3** `accepted_by_kind ∈ {human, auto}`; `auto` exige
  `accepted_rule_version` (CHECK no banco + 422 na API). O contrato pode exigir
  aceite humano (`require_human_accept`): aí aceite `auto` não conta.
- **D-C4** Evento sem `task_id` fica fora do cálculo; a tela mostra a
  cobertura por agente (eventos com task ÷ eventos do período).
- **D-C6** O snapshot guarda custo-hora, preços, modelo e versão de preço usados.

## Compatibilidade

- Payload antigo de `POST /agents/:id/events` → mesma resposta, byte a byte.
- Colunas novas de `agent_events` são todas anuláveis; um trigger preenche
  `org_id`/`project_id` a partir do agente quando o INSERT não informa (seed,
  scripts, conectores), como a 0022 fez com as chaves.
- Conta, projeto e ambiente vêm **sempre** da credencial; campos de tenant no
  corpo são ignorados.
- `business_case` fica só leitura, como texto de referência; nenhuma string é
  convertida em número.

## Fora do escopo

Veredito manter/ajustar/aposentar; trilha imutável assinada (E6); fila e
transporte da E3; leitura da tabela de preços da Veltrix por API (decisão em
aberto 1 — o cálculo recebe a tabela como entrada versionada e, sem ela, o
modelo de referência fica "indisponível"); aplicação em staging (CZ.1).

## Critérios de aceite

- `make ci` e `make ci-integration` verdes.
- up → down → up de 0023..0026 com retrato de schema idêntico.
- Golden test de 3 agentes batendo ao centavo com a planilha
  `specs/004-cunha/golden.csv`.
- Nenhum `score: 50` literal em camada; landing sem número literal em card de
  métrica e sem os termos da R6.
