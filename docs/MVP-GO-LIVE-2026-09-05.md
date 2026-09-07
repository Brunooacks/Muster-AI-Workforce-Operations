# Muster — Plano de Go-live do MVP em 05/09/2026

> Registro histórico do corte de 05/09/2026. A avaliação atual e reproduzível
> está em `docs/MATURITY-EVALUATOR.md` e deve prevalecer para qualquer decisão
> de comercialização.

## Decisão de escopo

O objetivo de sábado é colocar no ar um **piloto operacional vertical**, não
declarar concluído todo o PRD V1. O fluxo que será promovido é:

```text
autenticar → selecionar organização → conectar/admitir agente → ingerir evento
→ observar métricas → modelar equipe/jornada → decidir ação → gerar relatório
```

Qualquer superfície demonstrativa permanece somente em `/prototipos`. Rotas
produtivas não podem inventar agentes, métricas, equipes ou jornadas.

O corte não reimplementa o produto a partir do PRD. A experiência Workforce OS
existente é preservada e recebe dados, persistência, estados vazios e ações
operacionais reais. O PRD é usado somente para localizar furos e definir gates.

## Estado comprovado em 04/09

| Capacidade | Estado | Evidência atual | Gate de sábado |
|---|---|---|---|
| Login e sessão Clerk | Funcional | bypass removido; API retorna `401` sem sessão | smoke com usuário de produção |
| Isolamento por organização | Validado em integração | testes tenant-scoped com PostgreSQL real | repetir no banco de release |
| Shell produtivo | Funcional | rotas centrais consomem APIs e laboratório fica isolado | smoke desktop e mobile |
| Dashboard da frota | Funcional | resumo, KPIs e alertas reais com refresh de 60 s | reconciliar tenant piloto |
| Biblioteca de métricas | Funcional | listar, criar, editar e excluir métricas via API | criar uma métrica e recarregar |
| Equipe mista | Piloto funcional | criar equipe e propósito persistidos | uma equipe real; membros completos ficam pós-piloto |
| Jornada A2A | Piloto funcional | CRUD/monitor/recomendações via API | uma jornada persistida com reload |
| Conectores | Piloto funcional | GitHub + contrato universal/SDK; health e primeiro evento | provar um evento real |
| Telemetria contínua | Validada em integração | ingestão, deduplicação, outbox, worker e SSE | observar worker e freshness |
| Decisão e plano | Funcional | aprovar, ajustar e rejeitar persistem ação e SLA | executar os três resultados |
| Benchmarks e governança | Funcional para leitura | projeções tenant-scoped via API | validar estados vazios e preenchidos |
| Relatório executivo | Piloto funcional | snapshot e integração com PostgreSQL | gerar após dados reais e reconciliar |
| Imagem de produção | Funcional | SPA + API + migrations no mesmo container | build e subida no host público |

### Evidência executada

| Gate | Resultado em 04/09 |
|---|---|
| Unitários | 354 aprovados |
| Integração PostgreSQL | 14 aprovados em 5 arquivos |
| E2E público | 58 aprovados em desktop e mobile |
| E2E autenticado automático | 24 preparados; aguardam `PLAYWRIGHT_STORAGE_STATE` |
| Build workspace | aprovado com typecheck de todos os artefatos |
| Compose | configuração válida |
| Imagem | `muster:release-2026-09-05` construída |
| Smoke da imagem | SPA, API e worker aprovados; container `healthy` |

Os testes de integração devem executar com exclusividade sobre a fila utilizada
no teste. Um worker externo apontando para o mesmo banco pode consumir o outbox
antes da asserção e invalidar o ambiente, mesmo sem defeito de isolamento.

## Fora do gate de sábado

Esses itens permanecem no PRD, mas não devem bloquear o piloto vertical nem ser
vendidos como concluídos:

- lifecycle transacional completo de mentoria, promoção, suspensão e aposentadoria;
- Kanban unificado para todas as ações e rotinas;
- hierarquia completa companhia → unidade → área → squad → grupo;
- RBAC contextual em todos esses níveis;
- sincronização bidirecional de backlog com Jira, Linear ou ferramenta equivalente;
- adapters nativos de todos os providers do catálogo;
- SLO de 99,9% e envelope de 20 organizações comprovados em produção;
- autonomia de execução de ações críticas sem aprovação humana.

## Sequência até o go-live

### Board final de execução

| Trabalho | Owner | Estado | Entrada/critério de conclusão |
|---|---|---|---|
| Congelar o corte e corrigir P0 | Codex | Concluído | fluxo vertical sem superfícies estáticas em produção |
| Unitários, integração, E2E público e build | Codex | Concluído | evidências da seção anterior aprovadas |
| Imagem e smoke unificado | Codex | Concluído | container saudável servindo SPA, API e worker |
| Provisionar host, banco, TLS e DNS | Owner | Pendente | host Docker acessível e domínio resolvendo com HTTPS |
| Configurar Clerk de produção | Owner | Pendente | chaves no host e redirects do domínio autorizados |
| Publicar e aplicar migrations | Codex | Pendente de acesso | Compose ativo sem concorrência de migrations |
| Provar tenant e workload piloto | Codex + Owner | Pendente de ambiente | evento real refletido em métrica, decisão e relatório |
| Executar smoke e roteiro autenticado público | Codex | Pendente de ambiente | zero P0 e todos os critérios `Go` atendidos |
| Ensaiar backup e rollback | Codex + Owner | Pendente de ambiente | restauração documentada e imagem anterior recuperável |

### 04/09 — congelamento e gauntlet

1. Congelar novas features fora do fluxo vertical.
2. Executar unitários, integração, build, smoke HTTP e navegação autenticada.
3. Construir a imagem Docker de release.
4. Criar tenant piloto, agente, métrica, equipe, jornada e evento reais.
5. Registrar defeitos P0/P1; corrigir somente bloqueadores.

### 05/09 — deploy e promoção

1. Subir PostgreSQL e container em host público com TLS.
2. Aplicar migrations uma única vez e verificar health do worker.
3. Configurar domínio e URLs permitidas no Clerk de produção.
4. Executar o smoke público com `pnpm release:smoke -- https://dominio`.
5. Executar o roteiro autenticado e reconciliar UI, API e relatório.
6. Ensaiar rollback da imagem e restauração do banco.
7. Promover somente com zero P0 e sem divergência de tenant/dados.

## Critérios go/no-go

### Go

- login e logout funcionam no domínio público;
- organização ativa é provisionada sem intervenção no banco;
- nenhum tenant acessa dados de outro;
- um agente recebe primeiro evento real e atualiza o dashboard;
- criação de métrica, equipe e jornada sobrevive a reload;
- aprovação, ajuste e rejeição produzem registro persistido e auditável;
- relatório contém os dados do mesmo tenant e período;
- `/api/healthz` e `/api/healthz/worker` estão saudáveis;
- backup, logs e rollback estão documentados.

### No-go

- qualquer bypass de autenticação;
- dado sintético apresentado como real;
- `5xx` no fluxo vertical;
- vazamento entre organizações;
- perda ou duplicação contábil de evento;
- CTA crítico sem persistência;
- relatório vazio apresentado como conclusão;
- migration concorrente ou sem plano de rollback.

## Dependências do owner

Para efetivamente publicar, o owner precisa fornecer até o início de 05/09:

1. host Linux público com Docker ou acesso ao serviço de deploy escolhido;
2. domínio/subdomínio e acesso ao DNS;
3. chaves **de produção** do Clerk e cadastro do domínio/redirects;
4. senha do PostgreSQL e política de backup do ambiente;
5. usuário de teste e organização piloto no Clerk;
6. decisão de qual agente/jornada real será a prova pública;
7. confirmação de que ações críticas exigirão aprovação humana no piloto.

Segredos devem ser configurados no ambiente do host, nunca commitados.

## Comandos de promoção

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.release.yml config --quiet
docker compose --env-file .env.production -f docker-compose.release.yml up -d --build
pnpm release:smoke -- https://muster.seudominio.com
```

O status correto após esses gates é **piloto operacional em produção**. A
declaração **PRD V1 concluído** exige ainda G1, G3, G4 e G5 completos.
