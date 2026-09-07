# Cenyra — agentes de inteligência de mercado

Projeto Docker independente para acompanhar diariamente fontes públicas,
preservar evidências e gerar um relatório web comparável. Ele pode operar
sozinho ou funcionar como laboratório de agentes antes da admissão no Muster.

## Consultar

O dashboard organiza os resultados como uma fila priorizada, com destaques,
valores públicos, ranking, potencial, complexidade e dossiê de oportunidade.

- painel local: `http://localhost:8095`;
- filtros: fonte, score mínimo e categoria;
- detalhe: comprador, captura de valor, MVP, GTM, riscos e referências;
- operação: nova varredura, histórico e saúde de cada agente.

## Agentes

| Agente | Framework | Fonte | Entrega |
| --- | --- | --- | --- |
| Radar Melhor Lance | LangChain | melhorlance.dev | ranking, produtos, links, cliques, valores e temas brasileiros |
| Outbid Global Scout | CrewAI | outbid.lol | ranking global traduzido, categorias, valores, cliques, concorrência e dossiê de negócio |
| YC RFS Opportunity Miner | Agno | ycombinator.com/rfs | estações traduzidas, autoria, referências, concorrentes e tese de oportunidade |
| Cenyra Synthesizer | Orquestrador local | snapshots persistidos | ranking normalizado e relatório interativo |

Os coletores são determinísticos. O enriquecimento agentic é habilitado com `OPENAI_API_KEY`; sem chave, o laboratório continua funcional com scoring heurístico e registra a cobertura de IA como zero. `LLM_BASE_URL` permite usar vLLM ou outro endpoint OpenAI-compatible local. A pesquisa de concorrentes usa `TAVILY_API_KEY` quando disponível.

O agente YC lê todas as estações publicadas no bundle oficial da página, não apenas a aba visível no primeiro carregamento. Outbid e YC identificam o idioma, traduzem título e síntese para português e detalham problema, solução possível, perfil de cliente, comprador econômico, captura de valor, modelos de receita, sinais, concorrência, diferenciação, MVP, entrada no mercado, experimentos e riscos. Sem LLM, o fallback permanece útil, mas marca a tradução como indisponível em vez de fingir cobertura.

## Executar

```bash
git clone https://github.com/Brunooacks/Cenyra-Market-Intelligence.git
cd Cenyra-Market-Intelligence
cp .env.example .env
docker compose up -d --build
docker compose logs -f scheduler
```

Quando executado dentro do monorepo Muster, entre primeiro em
`labs/market-intelligence` e continue a partir do `cp .env.example .env`.

Dashboard: `http://localhost:8095`

O scheduler executa uma coleta ao iniciar e repete diariamente às `02:30 America/Sao_Paulo`. Para alterar, edite `DAILY_RUN_HOUR` e `DAILY_RUN_MINUTE` no `.env`.

## Operações

```bash
# Executar todas as fontes sob demanda
docker compose exec scheduler market-lab collect --source all

# Executar um agente isoladamente
docker compose exec scheduler market-lab collect --source melhorlance
docker compose exec scheduler market-lab collect --source outbid
docker compose exec scheduler market-lab collect --source yc-rfs

# Inspecionar estado e logs
docker compose exec scheduler market-lab status
docker compose logs --tail=200 scheduler dashboard

# Encerrar preservando o histórico
docker compose down
```

## Endpoints

- `/api/report`: último relatório consolidado.
- `/api/opportunities`: oportunidades com filtros `source` e `min_score`.
- `/api/runs`: execuções e KPIs dos agentes.
- `/api/history`: evolução diária dos relatórios.
- `/api/run`: inicia uma coleta manual em segundo plano.
- `/metrics`: métricas Prometheus.
- `/health`: health check do dashboard.

## Métricas qualificáveis

Cada execução registra volume, links, cobertura de preço/ranking/autoria, tradução, dossiê de negócio, enriquecimento, pesquisa de mercado, duração, tokens, custo estimado, hash da fonte e degradações. Os snapshots não são sobrescritos, permitindo comparar mudanças de ranking e sinal ao longo dos dias.

## Limites e governança

- Coleta somente páginas públicas e, por padrão, uma vez ao dia.
- Não realiza login, bypass, compra, lance ou ação transacional.
- Mantém URL e evidência de origem para auditoria.
- Parsers podem exigir recalibração quando os sites alterarem o HTML; a queda de cobertura aparece nos KPIs.
- Este laboratório não envia dados ao Muster. O arquivo `agents.yaml` é apenas o futuro contrato de admissão.

## Testes locais

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
pytest
```
