# MUS-172 — Detector de passos repetidos e certificação de destilação

## Contexto, objetivo e limites

O Muster observa a execução que o cliente reporta, detecta candidatos a
simplificação, recomenda uma ação, certifica uma mudança em *shadow* e mede o
resultado. O objetivo desta fatia é desenhar essa cadeia para encontrar um
passo que, para a mesma entrada, produz repetidamente a mesma saída e consome
parcela material do custo. A recomendação resultante é `distill_step`.

O Muster **não** gera, hospeda, altera, aprova nem executa código do cliente.
Ele também não escolhe ou publica um modelo substituto. A implementação e o
deploy da alternativa ficam no ambiente e sob a responsabilidade do cliente;
o Muster somente recebe telemetria, aplica gates e registra uma certificação
ou alerta de rollback.

Não são objetivos desta issue: capturar prompts, respostas, documentos,
segredos ou qualquer payload bruto; fazer treinamento/fine-tuning; tornar a
recomendação um deploy automático; nem substituir a avaliação humana. O
`inputFingerprint` e o `outputHash` são calculados no SDK/integração antes do
envio. O serviço rejeita campos de conteúdo bruto nessa seção e não conserva o
corpo HTTP em log, outbox, evidência ou `metadata`.

## Contrato de ingestão v2

O contrato v2 de MUS-171 (PR #47, ainda não integrado nesta base) introduz
`taskRunId`, `currency` e `validation` no feedback. MUS-172 o estende apenas
para eventos `execution` com `execution.steps`; os campos v2 existentes
continuam no lugar definido por MUS-171. `taskRunId` correlaciona execução,
feedback e os passos; `currency` torna `costCents` interpretável; e
`validation` determina quais tarefas entram nas estimativas e gates.

```json
{
  "contractVersion": "muster.agent-ingestion.v2",
  "eventId": "evt-2026-10-11-00042",
  "agent": { "externalId": "triagebot", "name": "Triage Bot", "version": "4.2" },
  "execution": {
    "taskRunId": "run_01J...",
    "currency": "BRL",
    "costCents": 184,
    "tokensIn": 2910,
    "tokensOut": 420,
    "steps": [
      {
        "stepKey": "classify.ticket.v1",
        "inputFingerprint": "sha256:17b4...",
        "outputHash": "sha256:8ad0...",
        "path": "model",
        "model": "gpt-5-mini",
        "tokensIn": 1120,
        "tokensOut": 96,
        "costCents": 71,
        "shadow": false
      }
    ]
  },
  "feedback": {
    "taskRunId": "run_01J...",
    "currency": "BRL",
    "validation": { "status": "accepted", "validatedAt": "2026-10-11T03:12:44Z" }
  }
}
```

### Regras de validação

- `steps` é opcional no v2 para permitir adoção gradual; quando presente é
  uma lista não vazia, com no máximo 100 itens e sem `stepKey` repetido no
  mesmo `taskRunId`.
- `stepKey` é um identificador estável, legível e versionado pelo cliente
  (por exemplo, `classify.ticket.v1`), de 1 a 160 caracteres. Renomeá-lo
  inicia uma nova série; não se deve reutilizá-lo para semântica diferente.
- `inputFingerprint` e `outputHash` são strings `sha256:<64 hex>` (ou versão
  futura explicitamente suportada). O fingerprint deve ser um HMAC/Hash de
  uma serialização canônica no ambiente do cliente; não pode conter texto,
  URL, base64 ou PII reversível. Para prevenir correlação entre organizações,
  a chave de HMAC é específica da organização e nunca é enviada ao Muster.
- `path` é exatamente `model`, `code` ou `human`; `model` é obrigatório só
  para `path=model` e ausente para os demais. `tokensIn`, `tokensOut` e
  `costCents` são inteiros maiores ou iguais a zero; `costCents` usa a moeda
  declarada pela execução/feedback, com ISO-4217 de três letras.
- `shadow` é booleano. Um passo de shadow preserva o mesmo `taskRunId` do
  passo principal, mas nunca é a saída operacional do cliente. Ele é elegível
  para o gate de comparação, não para somar economia realizada.
- `taskRunId` deve existir no evento e no feedback que valida a tarefa. Em
  ausência de `validation.status=accepted` (ou o valor aprovado pelo contrato
  v2), a execução pode informar o detector, mas não a estimativa de economia
  mensal nem a promoção.
- `metadata` continua sendo metadado permitido pelo contrato atual, mas a
  validação v2 bloqueia chaves de payload de passos conhecidas (`prompt`,
  `input`, `output`, `messages`, `response`, `content`) em qualquer nível de
  `execution.steps`. Logs de parse usam somente identificadores e motivos.

### Compatibilidade

O endpoint aceita `muster.agent-ingestion.v1` sem `execution.steps` e mantém
o comportamento atual de `agent_events`; v1 nunca recebe recomendação por
passo. V2 sem `steps` também é válido e permite que MUS-171 seja liberada sem
coordenar todos os SDKs. V2 com passos persiste os campos derivados e mantém
o evento agregado para as métricas existentes. Um consumidor v1 ignora os
campos novos; um consumidor que não reconhece v2 deve receber erro explícito,
não *downgrade* silencioso. A enumeração de versões em
`lib/connectors/types.ts` e o schema Zod são a fonte de verdade após o merge
do PR #47.

## Persistência e retenção

### Decisão: `agent_event_steps` normalizada

Recomenda-se uma tabela `agent_event_steps`, filha de `agent_events`, em vez
de colocar a lista em `agent_events.metadata`.

| Coluna proposta | Finalidade |
| --- | --- |
| `id` | identificador do registro |
| `org_id`, `agent_id` | escopo multi-tenant explícito e filtro eficiente |
| `agent_event_id` | FK para `agent_events`, `ON DELETE CASCADE` |
| `task_run_id`, `occurred_at` | correlação com feedback e janela analítica |
| `step_key`, `step_version` | identidade estável do passo (a versão também pode ser derivada do sufixo inicialmente) |
| `input_fingerprint`, `output_hash` | somente derivados não reversíveis |
| `path`, `model`, `shadow` | origem e modo de execução |
| `tokens_in`, `tokens_out`, `cost_cents`, `currency` | custo por passo, sem arredondamento adicional |
| `created_at` | rastreabilidade e expurgo |

Índices: único em `(agent_event_id, step_key)`; `(org_id, agent_id,
step_key, occurred_at DESC)` para a janela do detector; `(org_id, step_key,
input_fingerprint, occurred_at DESC)` para agrupar saída; e parcial em
`(org_id, agent_id, step_key, occurred_at DESC) WHERE shadow = true` para o
gate. A FK de `agent_id` reforça a linhagem, mas a escrita deve verificar que
evento, agente e organização pertencem à mesma cadeia.

`jsonb` em `metadata` seria mais rápido para a primeira escrita e não exigiria
migração, mas torna o agrupamento por fingerprint caro, dificulta índices
parciais/retensão e deixa o formato sem contrato. É aceitável somente como
ponte transitória para o envelope bruto em memória; não como armazenamento de
passos. A tabela normalizada permite retenção independente: reter agregados e
decisões por prazo de auditoria da organização, expurgar linhas de passo após
90 dias por padrão (configurável por organização) e preservar somente
agregados de detector, recomendação e auditoria. O expurgo não pode apagar
uma linha enquanto ela for a única evidência de uma certificação ativa; nesse
caso, conserva-se o agregado não reversível e sua referência de auditoria.

Esboço, sem criar migração nesta issue: criar a tabela e seus índices; fazer
escrita transacional junto a `agent_events`; ativar leitura do detector para
novos dados; executar job diário de retenção em lotes com métrica de linhas
expurgadas; e só então retirar qualquer ponte em `metadata`. A migração deve
ser aditiva e reversível (derrubar somente a tabela nova), sem backfill de
payloads antigos.

## Detector: função pura e configurável por organização

O detector não acessa banco, relógio ou rede. O adaptador consulta a janela de
linhas normalizadas e a configuração da organização, filtra passos elegíveis,
e chama uma função pura. Sua saída é uma lista de candidatos com estatísticas
e razões de exclusão — nunca uma decisão de execução.

```ts
type DetectorInput = {
  steps: ReadonlyArray<StepObservation>; // sem payload bruto
  policy: {
    minSamples: number;                 // padrão 200
    minDominantOutputRate: number;      // padrão 0.98
    minCostShare: number;               // padrão 0.20
    excludedStepKeys: readonly string[];
  };
};

type DetectorOutput = ReadonlyArray<{
  stepKey: string;
  sampleSize: number;
  dominantOutputRate: number;
  costShare: number;
  dominantOutputHash: string;
  eligible: boolean;
  reasons: string[];
}>;
```

Os padrões são `N >= 200`, ao menos 98% de mesma entrada para a mesma saída e
ao menos 20% do custo observado das tarefas válidas na janela. Todos são
configuráveis por organização, com validação de `N >= 1`, taxas entre 0 e 1 e
registro auditável de quem alterou o limiar. Para uma chave de passo, o
denominador é o número de observações de tarefas validadas e não-shadow com
fingerprint e hash presentes. Para cada `inputFingerprint`, escolhe-se o
`outputHash` modal; a taxa é a soma das ocorrências modais dividida pelo
denominador. Assim, entradas diferentes podem ter saídas determinísticas
diferentes sem parecer instabilidade.

O custo compartilhado é `sum(costCents do passo) / sum(costCents de todos os
passos elegíveis das mesmas task runs)`; se o denominador for zero ou houver
moeda misturada, o resultado é inelegível. A janela deve segmentar por
organização, agente, `stepKey`, moeda e `releaseId` atual para não misturar
versões. Etapas de julgamento ficam fora: a política inicia com uma lista
explícita de `excludedStepKeys` por organização/agente e uma etapa sem marcação
de classificação segura não recebe recomendação. Não se infere julgamento do
nome do modelo, da taxa observada ou de `path`; o cliente deve registrar a
chave na exclusão antes da ingestão. `path=human` é excluído por padrão.

Pseudo-código:

```text
detect(steps, policy):
  valid = steps onde validation=accepted, shadow=false,
          fingerprint/hash/cost presentes, path != human,
          stepKey não está em excludedStepKeys
  totalCost = soma(valid.costCents) por moeda e release
  para cada (stepKey, moeda, release) em valid:
    se count(grupo) < policy.minSamples: emitir inelegível(minimum_sample)
    para cada inputFingerprint: contar outputHash; somar a maior contagem
    stability = somaDosModais / count(grupo)
    share = soma(grupo.costCents) / totalCost
    emitir candidato somente se stability >= minDominantOutputRate
           e share >= minCostShare; caso contrário, emitir razões
```

Casos de teste da futura função pura:

1. 200 replays de `classify.ticket.v1`, cada fingerprint com um único hash de
   saída, e 25% do custo: candidato elegível.
2. 200 replays com 195 coincidências modais (97,5%): não elegível por
   `dominant_output_rate`.
3. 199 replays estáveis a 40% do custo: não elegível por amostra insuficiente.
4. 200 replays estáveis a 19,9% do custo: não elegível por participação de
   custo.
5. `judge.refund.v1` explicitamente excluído, ainda que estável e caro: não
   aparece como candidato. O mesmo passo com `path=human` também é excluído.
6. Duas entradas, cada uma sempre com sua saída, mas hashes diferentes entre
   elas: elegível (replay determinístico, não igualdade global de saída).
7. Moeda ausente/misturada, hash ausente, feedback não validado ou `shadow`:
   não conta para a recomendação nem para a economia realizada.

## Recomendação e estimativa

Ao satisfazer o detector, o Muster cria uma linha em `verdict_actions` com
`action = "distill_step"`, `status = "proposed"` e `owner` padrão do dono
técnico do agente. A evolução recomendada de schema para implementação é
adicionar `action_type` (enum extensível) e `metadata jsonb` para que o texto
continue legível e os dados estruturados não sejam espremidos em `evidence`.
Enquanto essa evolução não existir, `action` conserva o verbo e `evidence`
recebe uma referência a um artefato de recomendação, não conteúdo bruto.

O artefato inclui: `stepKey`, versão/release analisada, período, N, taxa modal,
participação de custo, moeda, hashes apenas como identificadores, política
efetiva, limitações e hipótese de economia. Ele descreve “o que observar e
validar”; nunca contém código, prompt, saída ou instrução de deploy.

Para tarefas aceitas e deduplicadas por `taskRunId`, a estimativa de tokens
economizados por mês é:

```text
tasksValidadasMensais × (tokensIn + tokensOut do passo atual
                         − tokensIn + tokensOut esperados no caminho candidato)
```

e a estimativa financeira em reais é:

```text
tasksValidadasMensais × (custoAtualCents − custoCandidatoCents) / 100
```

Ambas aparecem como hipótese, com faixa/pressupostos. Antes de existir medida
em shadow, `custoCandidatoCents` é uma projeção fornecida pelo cliente ou fica
indisponível; o produto não inventa preço. O valor efetivamente comunicado é
BRL somente para `currency="BRL"`; outras moedas são mostradas separadamente,
sem conversão cambial implícita. `costCents` por tarefa validada também é a
base para comparar a economia observada após a troca.

## Shadow, promoção e monitoramento

O cliente pode executar sua alternativa em paralelo e reportar os passos com
`shadow=true`; a saída de shadow não decide a tarefa. O Muster só certifica a
troca quando, por `stepKey` e versão candidata, houver pelo menos 200 pares
comparáveis, concordância `>= 99%` entre o hash do caminho principal e o hash
de shadow, e a avaliação existente `assessAgentRegression` não retornar
`regression`. Divergências sem payload não são julgadas pelo Muster: são
registradas como contagem e exigem a revisão do cliente.

O gate deve considerar a mesma distribuição de entradas e a política de
regressão já usada por `agent-regression.ts`: se a comparação não for
comparável, tiver amostra insuficiente, drift acima do limite ou status
`regression`, a certificação é bloqueada. `warning` não é promoção automática:
fica pendente de aprovação humana com justificativa auditável. A aprovação
não altera runtime; ela registra que uma nova `releaseId`, declarada pelo
cliente em telemetria, está certificada. O release anterior continua sendo o
fallback informado pelo cliente.

Após a troca, monitorar por janela configurada: taxa de validação/aceite,
falhas e escalonamentos, p95, custo por tarefa validada, tokens por tarefa,
drift de distribuição e cobertura de traces. A cada janela, comparar
`releaseId` novo contra baseline conforme a função de regressão atual. Gerar
alerta de rollback quando houver `regression`, queda de validação, divergência
de shadow se ainda ativo, custo acima do teto configurado ou ausência de
telemetria/feedback suficiente. O alerta recomenda voltar ao fallback e abrir
investigação; não aciona rollback nem executa alteração no ambiente do
cliente.

## Governança, RBAC e auditoria

MUS-111 é a autoridade: leitura de candidatos, métricas e alertas exige
`governance:read`; configurar limiares, exclusões, retenção, iniciar/encerrar
shadow, aceitar uma recomendação e registrar a certificação exige
`governance:manage` (na transição atual, owner/admin; membro só se o grupo de
acesso conceder a permissão). Credencial de agente ou integração pode apenas
enviar telemetria dentro do tenant e do agente autenticados; não pode ler
candidatos, mudar política, certificar nem confirmar uma ação. Toda consulta
e mutação mantém o filtro da organização derivado da identidade, nunca do
payload.

MUS-7 deve fornecer a trilha append-only para: mudança de política/exclusão e
retenção; execução do detector e sua versão; criação/alteração de
`distill_step`; início/fim de shadow; resultado do gate; proposta, aprovação
ou recusa de `releaseId`; alerta e reconhecimento de rollback. Cada evento
guarda organização, agente, ator/credencial, timestamp, correlação
`taskRunId`/ação/release quando aplicável, versão de política, valores antes e
depois e hashes/contagens derivados. Nenhum evento de auditoria guarda payload
bruto. O modelo de evidência deve usar linhagem compatível com `LineageStage`
(`source`, `aggregate`, `model`, `review`) para deixar claro que detecção é
agregação, gate é avaliação e aprovação é revisão humana.

## Plano de entrega em fatias (1–2 dias cada)

1. **Contrato e persistência (1–2 dias):** após merge de MUS-171, aceitar v1
   e v2, validar/rejeitar conteúdo bruto, criar `agent_event_steps` e escrita
   transacional. Testes Zod, rota de ingestão, idempotência e isolamento de
   tenant.
2. **Detector e recomendação (1–2 dias):** implementar função pura, política
   por organização, agregador e ação `distill_step`. Testes unitários para os
   sete casos acima e testes de integração para persistência/consulta.
3. **Shadow e certificação (1–2 dias):** parear passos, executar gate de 99%,
   integrar a avaliação de regressão e registrar `releaseId` certificado sem
   deploy. Testes de 200/199 pares, regressão, drift, warning e aprovação.
4. **Monitoramento e governança (1–2 dias):** métricas pós-troca, alertas de
   rollback, RBAC MUS-111, auditoria MUS-7 e job de retenção. Testes de
   autorização, trilha append-only, expurgo e alerta; E2E com SDK simulado.

Cada PR é aditivo, com migração somente na primeira fatia, testes antes da
implementação, `typecheck`, testes do pacote e integração onde houver banco.
Nenhuma fatia depende de acesso a payload bruto ou de executar código do
cliente.

## Riscos e perguntas abertas para o Bruno

- Qual semântica exata e quais valores de `feedback.validation` MUS-171
  adotará? O desenho usa `accepted` como exemplo; o enum final deve ser a fonte
  de verdade para “tarefa validada”.
- Quem calcula e rota a alternativa em shadow? O contrato assume o runtime do
  cliente, mas precisa definir o identificador da variante/candidato sem
  transportar implementação.
- A janela padrão de retenção de 90 dias atende os contratos dos clientes ou
  deve existir mínimo por setor? É necessário decidir antes de criar o job de
  expurgo.
- A exclusão de julgamento precisa de uma origem confiável. Recomenda-se
  configuração explícita por organização/agente antes da coleta; confirmar se
  haverá um catálogo de `stepKey` e quem o administra.
- `verdict_actions` deve ganhar `action_type`/`metadata` nesta iniciativa ou a
  primeira entrega pode usar apenas o verbo textual e uma referência de
  evidência? A opção estruturada é mais segura para filtro e auditoria.
- Os limites padrão (N=200, 98%, 20%, shadow=99%) são deliberadamente
  conservadores; Bruno deve definir se algum domínio regulado exige valores
  superiores ou revisão humana obrigatória até mesmo sem `warning`.
