# Storyboard — Microdemos da Central de Adoção

## Contrato

- Uma composição parametrizada gera dez tutoriais de 40 segundos.
- Cada vídeo mostra rota, pré-requisito, quatro ações de configuração, validação, estado concluído e próximo passo.
- A captura do produto é evidência dominante; textos não afirmam integração ou telemetria além do estado implementado.
- Sem locução nesta versão. O player da aplicação preserva controle, pausa e replay.
- Seis capítulos usam o cenário real do tenant autenticado: Atena Code Guardian, 98 execuções, regressão, mentoria, decisão e fechamento.

## Ritmo por vídeo

1. `0–5s` — objetivo, rota e pré-requisito.
2. `5–14s` — passos 1 e 2 com leitura guiada da tela.
3. `14–21s` — passos 3 e 4, clique em foco e mudança de estado.
4. `21–29s` — teste explícito: como saber que a configuração funcionou.
5. `29–34s` — estado concluído e evidência observada no tenant.
6. `34–40s` — próximo fluxo para continuar a jornada end-to-end.

## Capítulos

| ID | Fase | Tela principal | Evidência final |
|---|---|---|---|
| `build` | Admissão | 7 passos → prontuário | Agente admitido e contrato versionado |
| `connect` | Conexão | Credencial → teste → evento | Runtime ativo, freshness e execução comprovados |
| `metrics` | Métricas | Fórmula → baseline → scorecard | KPI ligado ao dever e à evidência |
| `monitor` | Supervisão | Comparação → alerta | Regressão com owner, prazo e recomendação |
| `mentor` | Mentoria | Diagnóstico → plano | Ações, metas e critérios de encerramento |
| `decide` | Decisão | Justificativa → tarefas | Consequência executada e auditável |
| `teams` | Equipe mista | Propósito → backlog | Execução e accountability separadas |
| `journey` | Jornada A2A | Etapas → handoffs | Gargalo e resultado end-to-end explicados |
| `governance` | Governança | Escopo → política → teste | Herança, exceção e auditoria comprovadas |
| `report` | Board | Período → revisão → publicação | Fechamento executivo ligado à evidência |
