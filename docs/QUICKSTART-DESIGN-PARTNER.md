# Quickstart para design partners

Este guia conecta um agente já em execução ao Muster. A credencial é exclusiva
do agente: use-a apenas no runtime dele e guarde-a em um secret manager.

## 1. Aceite o convite e entre na organização

1. Aceite o convite recebido por e-mail e entre com a conta convidada.
2. Selecione a organização do piloto no seletor da aplicação. Não crie nem
   escolha uma organização de outro parceiro.
3. Abra **Admissão** (`<MUSTER_URL>/admissao`) e registre o agente com nome,
   responsabilidade e owner. Ao concluir, copie o identificador exibido em
   **Frota**; ele será o `<AGENT_ID>` deste guia.

## 2. Gere a credencial do agente

Abra o agente em **Frota**, selecione **Conectar telemetria** e clique em
**Gerar credencial**. Copie o valor mostrado uma única vez para o secret
manager do runtime. O Muster guarda somente o hash; para recuperar uma chave
perdida, gere outra e substitua a anterior.

Use estes nomes de configuração no ambiente do agente:

```bash
MUSTER_URL=<MUSTER_URL>
MUSTER_AGENT_ID=<AGENT_ID>
MUSTER_AGENT_TOKEN=<AGENT_TOKEN>
```

## 3. Envie o primeiro evento

Cada ocorrência deve ter uma `idempotencyKey` estável. Se a rede falhar, repita
o mesmo payload e a mesma chave: a segunda resposta terá `duplicate: true` e
não criará outro evento.

### cURL

```bash
curl --fail-with-body -X POST "<MUSTER_URL>/api/agents/<AGENT_ID>/events" \
  -H "Authorization: Bearer <AGENT_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{
    "idempotencyKey": "execucao-2026-10-03-001",
    "kind": "execution",
    "success": true,
    "durationMs": 420,
    "metadata": { "source": "design-partner" }
  }'
```

O retorno esperado na primeira chamada é `202` com
`{"accepted":true,"duplicate":false}`. Para confirmar vida do processo, use
o mesmo bearer em `POST /api/agents/<AGENT_ID>/heartbeat` com, por exemplo,
`{"runtime":"node","status":"healthy","intervalSeconds":60}`.

### Node.js (fetch, Node 18+)

```js
import { randomUUID } from "node:crypto";

const response = await fetch("<MUSTER_URL>/api/agents/<AGENT_ID>/events", {
  method: "POST",
  headers: {
    Authorization: "Bearer <AGENT_TOKEN>",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    idempotencyKey: randomUUID(), // gere uma vez e persista para retries
    kind: "execution",
    success: true,
    durationMs: 420,
    metadata: { source: "design-partner" },
  }),
});

if (!response.ok) throw new Error(`Muster respondeu ${response.status}`);
console.log(await response.json());
```

## 4. Rode o smoke test do kit

O script envia um heartbeat, um evento, repete exatamente esse evento com a
mesma `idempotencyKey` e verifica que um token inválido recebe `401`.

```bash
MUSTER_URL=<MUSTER_URL> \
MUSTER_AGENT_ID=<AGENT_ID> \
MUSTER_AGENT_TOKEN=<AGENT_TOKEN> \
node scripts/quickstart-smoke.mjs
```

Não há endpoint de leitura de telemetria que aceite credencial de agente: as
leituras exigem sessão humana da organização. Por isso, o smoke confirma a
ingestão pelas respostas `202` do POST, inclusive `duplicate: false` e depois
`duplicate: true`; ele não tenta reutilizar a credencial em uma leitura.

## Onde acompanhar no dashboard

- **Frota** (`<MUSTER_URL>/frota`): confirma que o agente foi admitido.
- **Conectar telemetria** (`<MUSTER_URL>/agentes/<AGENT_ID>/conectar`): mostra
  a chegada da primeira execução.
- **Prontuário do agente** (`<MUSTER_URL>/agentes/<AGENT_ID>`): acompanha
  telemetria, supervisão e decisão atual.
- **Relatórios**: acompanhe o relatório executivo produzido para a organização.

## Problemas comuns

| Sintoma | Como resolver |
| --- | --- |
| `401` | Confirme o header `Authorization: Bearer <AGENT_TOKEN>`, se a chave foi copiada por completo e se pertence ao mesmo `<AGENT_ID>`. Gere uma nova credencial se a original foi perdida ou revogada. |
| `404 Agente não encontrado` | Confirme que o agente foi admitido na organização selecionada e que `<AGENT_ID>` é o ID do Muster, não um ID interno do runtime. |
| Horário estranho ou eventos fora de ordem | Sincronize o relógio do host com NTP. Para eventos ao vivo, omita `ts`; para replay, envie ISO 8601 em UTC e mantenha a hora real da ocorrência. |

## Critério de sucesso do MVP por parceiro

O piloto está pronto para avaliação quando houver, na mesma organização:

1. Um agente admitido e conectado.
2. Sete dias de eventos reais do agente.
3. Uma decisão registrada a partir das evidências.
4. Um relatório executivo gerado e revisado pelo parceiro.

## Limite desta entrega

A validação contra staging será feita após a MUS-163. Até lá, o smoke deve ser
executado somente no ambiente fornecido para o piloto; o registro dessa
dependência está na MUS-168.
