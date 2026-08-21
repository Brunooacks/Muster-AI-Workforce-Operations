# Monitorar agentes que rodam localmente (vLLM / on-premise)

O caso: o agente roda dentro da infraestrutura do cliente, atrás do firewall,
servido por vLLM. Não há nuvem para consultar e, muitas vezes, não há permissão
para alterar o código do agente.

A boa notícia é que o vLLM já publica tudo o que interessa em `/metrics`, no
formato Prometheus. A ponte lê esse endpoint e traduz para o Muster. **Nenhuma
alteração no agente, nenhum sidecar, nenhuma porta aberta para fora.**

---

## O que a coleta enxerga — e o que não enxerga

Ser explícito aqui evita a decepção na terceira semana de piloto.

| | |
|---|---|
| **Enxerga** | Execuções concluídas, latência ponta a ponta, tempo até o primeiro token, tokens de entrada e saída, tamanho da fila, uso de cache KV, modelo servido |
| **Não enxerga — e isso é bom** | Conteúdo de prompts e respostas. O `/metrics` simplesmente não os expõe. A coleta é *estruturalmente* incapaz de vazar o que foi conversado: não depende de ninguém lembrar de desligar um flag |
| **Não enxerga — e isso é limitação real** | **Erro de aplicação.** Se o agente respondeu errado, ou decidiu errado, para o vLLM a requisição terminou com sucesso |

A consequência da última linha é a que importa para a avaliação: esta ponte
alimenta **eficiência** e **adoção** com dados fortes, mas **não** alimenta
**eficácia**. Para eficácia, o agente precisa reportar o desfecho — SDK ou REST,
como em qualquer outra integração. A plataforma vai continuar dizendo
"sem evidência" na camada de eficácia, e isso está correto: ela não inventa nota
que não pode sustentar.

---

## Por que a ponte amostra em vez de ler uma vez

O `/metrics` é **agregado e acumulado**: contadores que só crescem desde que o
servidor subiu. Uma leitura isolada não diz o que aconteceu agora — diz o total
histórico. Por isso a ponte guarda a leitura anterior e trabalha por diferença.

Duas consequências práticas:

1. **A primeira leitura nunca vira evento.** Ela é linha de base. Se fosse
   enviada, o Muster registraria milhares de execuções no minuto zero.
2. **Reinício do vLLM é detectado e a janela é descartada.** Contador que
   regride significa processo reiniciado; qualquer conta feita sobre essa janela
   seria ficção.

A duração de cada execução é a média da janela (Δsoma ÷ Δcontagem do
histograma), porque o histograma não expõe amostras individuais. Todo evento
enviado carrega `derivacao: "media-da-janela"` no metadata — o número é honesto
sobre o que é.

---

## Passo a passo

### 1. Confirme que o vLLM expõe métricas

```bash
curl -s http://localhost:8000/metrics | grep vllm:num_requests_running
```

Se não retornar nada, suba o vLLM com o servidor OpenAI-compatível
(`vllm serve <modelo>`), que habilita `/metrics` por padrão.

### 2. Cadastre o agente no Muster

Pela tela (**Cadastrar agente**), escolhendo plataforma `vllm` e a **área
responsável**. Ou por API:

```bash
curl -s -X POST http://localhost:8087/api/agents -H 'content-type: application/json' -d '{"name":"Assistente Interno (vLLM)","role":"Responde perguntas internas","platform":"vllm","bio":"Executado na infraestrutura do cliente.","areaId":"<id-da-area>"}'
```

### 3. Emita a credencial do agente

```bash
curl -s -X POST http://localhost:8087/api/agents/<AGENT_ID>/api-keys -H 'content-type: application/json' -d '{"label":"ponte-vllm"}'
```

O segredo aparece **uma única vez**. O servidor guarda só o SHA-256: um dump do
banco não permite replay contra o ingest.

### 4. Rode a ponte

```bash
pnpm --filter @workspace/scripts run bridge:vllm -- --endpoint=http://localhost:8000/metrics --agent-id=<AGENT_ID> --key=<msk_live_...> --intervalo=30
```

Parâmetros:

| Parâmetro | Padrão | Para que serve |
|---|---|---|
| `--endpoint=` | `http://localhost:8000/metrics` | Onde está o `/metrics` do vLLM |
| `--intervalo=` | `30` | Segundos entre amostras |
| `--ciclos=` | `0` (indefinido) | Quantas amostras coletar |
| `--preco=` | `0.15` | Centavos por mil tokens — **o rateio de GPU do cliente**, não um preço de API |
| `--dry-run` | — | Mostra o que enviaria, sem enviar |
| `--fixture` | — | Lê de arquivo local; permite ensaiar sem GPU |

### 5. Reavalie

```bash
curl -s -X POST http://localhost:8087/api/agents/<AGENT_ID>/reevaluate -H 'content-type: application/json' -d '{}'
```

O veredito volta com `dataSource: "telemetry"` — nota calculada sobre coleta
real, não sobre dado semeado.

---

## Ensaiar sem GPU

As fixtures em `scripts/fixtures/vllm-metrics-t0.txt` e `-t1.txt` são duas
leituras reais em sequência (49 execuções entre elas). Servem para demonstrar a
ponte inteira sem infraestrutura:

```bash
pnpm --filter @workspace/scripts run bridge:vllm -- --fixture --dry-run --intervalo=1 --ciclos=2
```

---

## Custo: a única informação que não vem da telemetria

Inferência local não é grátis — o custo é a GPU, medido por hora, não por token.
O `--preco` converte tokens em centavos usando o rateio que **o cliente**
informa. O padrão de 0,15 centavos por mil tokens é conservador e deve ser
revisado com a área de infraestrutura antes de qualquer conclusão sobre
custo-benefício.

---

## O que ainda não existe

Honestidade sobre o estado atual, para não gerar expectativa errada:

- A ponte roda como processo separado; **não há supervisor** que a reinicie
  sozinha. Para piloto, `systemd` ou um container com `restart: always`.
- **Um endpoint por processo.** Uma frota vLLM com várias réplicas atrás de um
  balanceador precisa de uma instância por réplica, ou de um Prometheus federando
  antes — este último caminho ainda não foi implementado.
- O estado (leitura anterior) vive em memória. Reiniciar a ponte custa **uma**
  janela de coleta, não mais que isso.

---

Ver também: [`docs/DEMO-LOCAL.md`](DEMO-LOCAL.md) para subir o ambiente inteiro.
