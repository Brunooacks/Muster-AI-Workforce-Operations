# Validação de agentes reais

## Regra de produto

O Muster não deve chamar um componente de **agente real** apenas porque o código
importa LangChain, CrewAI ou Agno. A classificação depende da evidência capturada
em cada execução:

| Nível | Evidência | Uso permitido no produto |
|---|---|---|
| L0 — sintético | persona, fixture ou falha injetada | teste e demonstração, sempre rotulado |
| L1 — runtime | processo ou container vivo, sem trabalho útil | supervisão de infraestrutura |
| L2 — trabalho observado | entrada externa, saída persistida, tempo e proveniência | operação real, análise ainda pode ser heurística |
| L3 — IA comprovada | chamada de modelo, tokens/modelo e saída correlacionados | avaliação técnica do agente |
| L4 — resultado validado | outcome aceito por humano ou sistema de negócio | decisão de promover, mentorar ou aposentar |

Nenhuma métrica L0 ou L1 pode ser apresentada como resultado de negócio. Uma
execução só recebe **grau de decisão** quando a fonte é observada, a tecnologia
de análise foi comprovada, não há degradação oculta e a qualidade cumpre a meta.

## Inventário auditado em 6 de setembro de 2026

### Gauntlet operacional

- Executa via `tsx` no host e termina ao final da campanha; não existe uma frota
  persistente desses oito nomes.
- Sete workloads são funções determinísticas com latência operacional modelada.
- O Atlas Build Sentinel executa comandos reais do repositório, incluindo testes
  e typecheck.
- Classificação: L0 para falhas/personas e L2 para os comandos realmente executados.

### Agent Runner

- Implementação real em Node.js + LangChain, com ferramentas permitidas para
  inspeção, testes, typecheck e validação do Compose.
- Pode executar no host, dentro de Docker ou por gateway remoto.
- O serviço `agent-runner` não estava ativo no Compose auditado; somente o
  PostgreSQL do Muster estava em execução.
- `AGENT_MODE=dry-run` não chama modelo nem ferramenta e deve permanecer L0/L1.
- `AGENT_MODE=live` exige identidade do agente, API key individual e provider
  configurado; somente então pode alcançar L3.

### Cenyra Market Foresight

- Três coletores e um orquestrador estão ativos em Docker local.
- Dashboard/API: `http://localhost:8095`.
- A coleta usa HTTPX + BeautifulSoup contra Melhor Lance, Outbid e YC RFS, com
  URL, horário e hash SHA-256 semântico preservados. O hash considera o conteúdo
  extraído e ignora HTML dinâmico, metadados de transporte e horário da coleta.
- As execuções auditadas coletaram dados reais, porém `llm_used=false`. Portanto,
  LangChain, CrewAI e Agno são tecnologias declaradas para enriquecimento, não
  tecnologias comprovadamente executadas nesse ciclo.
- Classificação atual: coletores L2; síntese derivada L2; análise L3 pendente.

### Frota comercial externa

- Projeto observado: `/Users/brunooliveira/dev/agent-fleet-growth`.
- Containers ativos: `prospector-langchain`, `qualifier-crewai`,
  `outreach-agno` e `leadmanager-go`.
- Os quatro possuem provider configurado, mas não possuem identidade nem token
  do Muster; nenhuma telemetria dessa frota entra atualmente na plataforma.
- O prospector apresenta falha repetida `HTTP 432`; os outros três estão vivos,
  porém sem backlog novo.
- Dos 1.572 leads encontrados no banco, 1.524 estão marcados como sintéticos e
  apenas 48 possuem fonte web não marcada como sintética. O histórico agregado
  não é uma baseline de negócio válida.

## Cenário 1 — fonte pública até o prontuário

O comando abaixo realiza o fluxo completo quando uma sessão Clerk válida é
fornecida:

```bash
pnpm run validate:real-agents -- \
  --token-file=/tmp/muster-session-token \
  --base-url=http://localhost:8081
```

Etapas:

1. registra os IDs anteriores;
2. dispara uma nova coleta nas três fontes públicas;
3. espera uma execução terminal nova por fonte;
4. valida registros e hash de origem;
5. classifica coleta, análise e grau de decisão;
6. cria a área `Laboratório de Evidência Real`;
7. configura um conector universal com credencial própria;
8. admite quatro profissionais com 13 métricas e três owners;
9. envia eventos e observações com `eventId` idempotente;
10. reavalia os profissionais e revoga as chaves temporárias.

Sem sessão, o mesmo cenário pode validar somente coleta e relatório:

```bash
pnpm run validate:real-agents -- --offline
```

Os artefatos ficam em `output/real-agents/cenyra/<run-id>/`.

### Campanha executada em 6 de setembro de 2026

Após reconstruir os containers, três ciclos novos foram executados desde a
fonte pública. Os três mantiveram exatamente 30 registros e 51 links no Melhor
Lance, 52 registros e 151 links no Outbid, e 96 registros e 172 links no YC RFS.
Cada fonte produziu um único hash semântico nos três ciclos, comprovando que o
conteúdo permaneceu estável sem falsos alertas causados pelo HTML dinâmico.

As durações observadas foram 760–1.710 ms, 800–1.700 ms e 1.968–3.146 ms,
respectivamente. Todos os ciclos registraram `llm_used=false`: a coleta é real
e reproduzível em L2, mas a análise continua heurística e não pode ser
apresentada como IA comprovada nem usada para uma decisão autônoma.

Artefatos da campanha:

- `output/real-agents/cenyra/2026-09-06T14-07-48-978Z/`
- `output/real-agents/cenyra/2026-09-06T14-08-01-386Z/`
- `output/real-agents/cenyra/2026-09-06T14-08-06-920Z/`

## Próximos cenários

### Cenário 2 — engenharia local e Docker

- admitir o Agent Runner com contrato técnico;
- executar `inspect_workspace`, testes e typecheck dentro de container isolado;
- correlacionar versão do agente, commit, entrada, ferramenta e saída;
- provocar teste quebrado, timeout e restart do container;
- exigir recuperação, evidência e veredito antes de promoção.

### Cenário 3 — jornada comercial A2A

- separar um banco limpo de homologação;
- remover o fallback sintético da execução marcada como live;
- corrigir ou trocar o provider que responde HTTP 432;
- executar prospecção, qualificação, rascunho e decisão em um work item rastreável;
- manter envio externo bloqueado e exigir aprovação humana;
- medir handoff, perda de contexto, qualidade, retrabalho, custo e outcome final.

## Estado do Git

Na auditoria, `HEAD` e `origin/main` apontavam para `b3a8180`, sem commits remotos
pendentes. Entretanto, o diretório de trabalho continha 102 arquivos rastreados
alterados e 233 entradas não rastreadas; o diretório `labs/` não possuía arquivos
rastreados pelo Git. Portanto, a versão operacional analisada ainda não está
integralmente preservada no GitHub.
