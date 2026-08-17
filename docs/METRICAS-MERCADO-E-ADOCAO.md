# Métricas de agentes: pesquisa de mercado e playbook de adoção

Atualizado em 2026-08-12.

## O padrão observado no mercado

As principais plataformas de observabilidade e avaliação convergem para um ciclo contínuo:

1. **Instrumentar traces e spans** para saber o que aconteceu em cada execução, incluindo modelo, ferramenta, tokens, latência e erros.
2. **Avaliar qualidade** com regras determinísticas, revisão humana e LLM-as-judge quando a qualidade não pode ser reduzida a uma asserção.
3. **Comparar com baseline** em datasets, experimentos e tráfego real antes de alterar o comportamento em produção.
4. **Monitorar online** com amostragem, alertas e detecção de anomalias.
5. **Retroalimentar** traces problemáticos para datasets e novos testes offline.

Referências consultadas:

- [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation): separa avaliação offline e online e recomenda transformar traces de produção em datasets.
- [LangSmith Evaluation Concepts](https://docs.langchain.com/langsmith/evaluation-concepts): recomenda exemplos de referência, avaliadores humanos, de código, LLM-as-judge e pairwise.
- [Arize Phoenix — pre-built metrics](https://arize.com/docs/phoenix/evaluation/pre-built-metrics): cobre faithfulness, correctness, tool selection, tool invocation e tratamento da resposta de ferramentas.
- [Arize Phoenix — evaluation](https://arize.com/docs/phoenix/evaluation/evals): combina avaliadores determinísticos, LLM-as-judge, datasets, experimentos e traces.
- [Datadog Agent Observability Metrics](https://docs.datadoghq.com/llm_observability/monitoring/metrics/): acompanha 100% do tráfego instrumentado para contagem, duração, erros, tokens e custo.
- [Braintrust Evaluate](https://www.braintrust.dev/docs/evaluate): conecta playground, experimento imutável, CI/CD, scoring em produção e feedback para novos datasets.

## Decisão de produto para o Muster

O Muster não deve oferecer apenas uma lista de KPIs. Cada métrica deve declarar:

- **O que mede e por que importa** para o propósito do time.
- **Fórmula, unidade, direção e meta**.
- **Fonte e linhagem** da evidência.
- **Baseline e amostra mínima** antes de influenciar um veredito.
- **Owner, cadência e guardrail**.
- **Impacto na decisão**: promover, mentorar, observar ou aposentar.

O catálogo já possui essas diretrizes nos contratos de KPI e agora oferece kits de início em `GET /api/catalog/metric-kits`.

## Kits recomendados

| Kit | Quando usar | Combinação mínima |
|---|---|---|
| Baseline operacional | Primeiro workload real | conclusão, p95, custo, disponibilidade, drift |
| Atendimento resolutivo | Suporte e service desk | FCR, reabertura, CSAT, escalonamento, MTTR |
| Vendas com guardrail | SDR, CRM e qualificação | conversão, uplift, falso positivo, adoção, política |
| Engenharia segura | Coding agents e operações IT | primeira passada, defeito escapado, revisão, falha de mudança, MTTR |
| Risco e supervisão | Fluxos sensíveis/regulados | trilha, dado sensível, escopo, guardrails, revisão humana |

## Regra de adoção para os times

1. Escolher um kit, não mais de 5–7 KPIs no primeiro ciclo.
2. Definir o baseline humano ou de homologação antes do rollout.
3. Instrumentar 100% dos eventos operacionais essenciais; usar amostragem apenas para avaliações caras.
4. Separar métricas de resultado, operação e risco.
5. Não promover com amostra insuficiente, evidência sem linhagem ou guardrail ausente.
6. Revisar semanalmente no início; depois ajustar a cadência conforme o risco.
7. Transformar incidentes e feedback humano em novos casos de teste.

## Limites atuais do MVP

- O catálogo e os kits estão populados, mas a associação automática de um kit a um propósito ainda precisa ser uma ação explícita do usuário.
- Telemetria operacional e heartbeat estão disponíveis; coletar dados de provedores/cloud via conectores ainda é uma etapa posterior.
- Avaliação de qualidade sem referência, como faithfulness, tool selection e segurança, precisa de spans/traces ricos e avaliadores configuráveis.
- O loop atual reavalia sob demanda. O próximo passo de produção é um worker agendado com deduplicação, alertas e política de custo para avaliações online.
