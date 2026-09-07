# Plano de campanha do Gauntlet

## Objetivo

Validar o Muster como sistema operacional de profissionais digitais em três
dimensões: resultado do trabalho, segurança operacional e capacidade de
supervisão contínua. A campanha usa agentes de desenvolvimento, atendimento,
finanças e portfólio, sempre com gabarito ou evidência verificável.

## Resultado atual

| Perfil | Execuções de negócio | Qualidade | p95 de negócio | Leitura |
|---|---:|---:|---:|---|
| `baseline` | 60 | 100% | até 0,01 ms | referência funcional aprovada |
| `stress` | 1.500 | 100% | abaixo de 1 ms | carga CPU-local aprovada |
| `chaos` | 600 | 91% | 40 ms | degradação deliberada detectada |

O agente de desenvolvimento executa quatro verificações reais por rodada:
integridade do diff, API, runner e scripts. Na rodada de 2 de setembro, o p95
foi de 6,4 s, incluindo 249 testes da API. Os resultados completos estão em
`output/gauntlet/operational/comparison.html`.

Esses números validam o harness e as regras dos workloads. Eles ainda não são
um benchmark de rede, banco ou API, pois a admissão integrada depende de uma
sessão Clerk válida.

## Onda 2 — API e supervisão real

Automação já pronta:

- admitir ou reutilizar oito profissionais `[gauntlet-real] v3` com 12 métricas;
- emitir uma credencial individual por agente;
- registrar heartbeat, execuções, custo, qualidade e evidência;
- executar em paralelo e solicitar reavaliação;
- consultar telemetria, freshness e estado de supervisão;
- aprovar, devolver para ajuste e rejeitar planos com justificativa, ações e SLA;
- produzir relatório HTML, Markdown e JSON.

Critérios de aprovação:

- 100% dos eventos vinculados a organização, agente, execução e propósito;
- nenhuma credencial presente em log ou relatório;
- p95 de ingestão abaixo de 500 ms no `stress` local;
- freshness abaixo de 60 s durante a carga;
- contagem no relatório igual à contagem enviada;
- prompt injection e ausência de owner encaminhados para decisão humana.
- decisões de plano append-only, isoladas por tenant e recuperáveis no prontuário.

Dependência humana: autenticar uma sessão Clerk `owner` ou `admin` e exportar
`MUSTER_AUTH_TOKEN`. O token deve permanecer somente no terminal local.

## Onda 3 — Docker e on-premise

| Cenário | Injeção | Métricas | Aprovação |
|---|---|---|---|
| Restart do runner | `docker restart` durante a carga | perdas, retries, recuperação | zero perda; recuperação < 60 s |
| API indisponível | bloquear porta por 60 s | backlog, retry, idade do evento | replay completo e ordenado |
| Provider indisponível | desligar vLLM/local mock | fallback, circuit breaker, custo | troca rastreada; sem loop infinito |
| CPU saturada | limitar CPU e gerar pressão | p95, fila, timeout | alerta antes de violar SLA |
| Memória restrita | limitar RAM e provocar OOM | restart, duplicidade, disponibilidade | recuperação sem dupla contagem |
| Rede degradada | latência e packet loss | erro, retry, freshness | degradação visível e reversível |

Pré-requisito atual: permitir o download da imagem `node:20-alpine` ou publicar
uma imagem base equivalente no registry interno. O build local parou apenas na
obtenção da imagem no Docker Hub.

## Onda 4 — Dados e event-driven

1. Pausar o PostgreSQL durante ingestão e confirmar retenção na outbox.
2. Reiniciar API e worker em pontos diferentes do processamento.
3. Reenviar o mesmo `executionId` e validar idempotência.
4. Entregar eventos fora de ordem e validar a janela temporal.
5. Criar backlog acima da capacidade e medir lag, drenagem e backpressure.
6. Rotacionar a credencial de um agente durante execução contínua.
7. Trocar organização ativa e provar ausência de vazamento entre tenants.

Gate: zero perda confirmada, zero dupla contagem, isolamento tenant comprovado,
RPO de 0 evento e RTO de até 120 s no laboratório.

## Onda 5 — Cloud

### AWS

- ECS/Fargate para API e runners, com IAM task role por workload;
- ADOT/OpenTelemetry para logs, métricas e traces;
- AWS Fault Injection Service para CPU, latência, packet loss e kill;
- PostgreSQL gerenciado e fila/outbox com alarmes de lag.

### Azure

- Azure Container Apps para API e runners, com managed identity;
- agente OpenTelemetry do ambiente e Azure Monitor;
- Azure Chaos Studio para falhas controladas e relatórios de resiliência;
- PostgreSQL gerenciado e alertas de fila/freshness.

### GCP

- Cloud Run para API stateless e jobs, com service account dedicada;
- OpenTelemetry Collector para logs, métricas e traces;
- teste incremental de concorrência, cold start e limite de instâncias;
- Cloud Service Mesh para fault injection quando o cenário exigir malha.

Critérios comuns:

- identidade curta de workload, sem chave cloud persistente;
- isolamento por tenant e ambiente;
- dashboards de qualidade, p95, throughput, custo, freshness e falhas;
- orçamento máximo e kill switch por campanha;
- SLO de ingestão e supervisão mantido durante scale-out;
- evidência exportável para auditoria e relatório executivo.

## Cenários funcionais adicionais

### Desenvolvimento

- issue → plano → alteração → revisão → aprovação → deploy;
- métricas: aderência ao escopo, testes, retrabalho, defeitos escapados,
  lead time, custo por entrega e intervenção humana;
- falhas: PR ambíguo, teste flakey, segredo no diff e rollback.

### Atendimento

- ticket → classificação → resolução → escalonamento → feedback;
- métricas: resolução, precisão, SLA, reabertura, transferência, CSAT e custo;
- falhas: prompt injection, PII, baixa confiança e indisponibilidade do CRM.

### Financeiro

- cobrança → conciliação → exceção → aprovação → fechamento;
- métricas: acurácia, divergências, dupla contagem, tempo de fechamento e risco;
- falhas: duplicidade, moeda divergente, valor ausente e fraude provável.

### Negócios

- sinais → tese → ranking → experimento → decisão;
- métricas: cobertura, qualidade da evidência, adoção, aprendizado e prazo;
- falhas: recomendação sem owner, fonte fraca e alto retorno sem governança.

## O que será automatizado

- criação e admissão dos agentes;
- geração de carga e falhas determinísticas;
- coleta de métricas e evidências;
- comparação baseline/stress/chaos;
- validação de freshness, contagem, isolamento e reprocessamento;
- geração dos relatórios executivo e técnico;
- limpeza dos agentes de laboratório quando solicitada.

## O que depende de você

1. Fazer login no Clerk e exportar `MUSTER_AUTH_TOKEN` localmente.
2. Autorizar o pull da imagem base Docker ou indicar o registry interno.
3. Escolher uma cloud inicial, conta/projeto, região e teto de gasto.
4. Autorizar a criação de recursos temporários e identidade de workload.
5. Indicar dois casos reais anonimizados de cada domínio prioritário.

Não envie tokens ou chaves pelo chat. Depois das escolhas, os scripts de
infraestrutura e execução podem ser automatizados sem credenciais no código.

## Ordem recomendada

1. Rodar admissão integrada local.
2. Capturar sessão Playwright e liberar as 23 jornadas autenticadas.
3. Executar Docker restart, rede e banco.
4. Validar fallback vLLM → provider cloud.
5. Repetir a mesma campanha em uma cloud.
6. Comparar local, on-premise e cloud no relatório consolidado.
