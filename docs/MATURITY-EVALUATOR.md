# Mara — agente avaliador de maturidade comercial

Mara é um auditor de prontidão com autonomia `L1`: executa verificações,
consolida evidências e recomenda um estágio seguro, mas não altera o produto,
não publica releases e não promove o Muster automaticamente.

## Decisão que o agente responde

O score não responde apenas se o software compila. Ele separa cinco estágios:

1. uso interno;
2. design partners;
3. piloto pago;
4. comercialização limitada;
5. disponibilidade geral.

Um score alto não compensa um gate crítico ausente. Piloto pago exige todos os
gates críticos comprovados; disponibilidade geral também exige os gates de
adoção e uma validação externa registrada.

## Como executar

Avaliação rápida, baseada nos artefatos já existentes:

```bash
pnpm run evaluate:maturity
```

Avaliação completa contra o ambiente local autenticado:

```bash
pnpm run evaluate:maturity -- --mode=full --base-url=http://127.0.0.1:5174
```

Avaliação completa incluindo uma release publicada:

```bash
pnpm run evaluate:maturity -- \
  --mode=full \
  --base-url=https://app.exemplo.com \
  --release-url=https://app.exemplo.com
```

Os relatórios são produzidos em `output/maturity/<timestamp>/report.json`,
`report.md` e `report.html`. O JSON é a fonte adequada para automação de CI.

## Gates auditados

- fluxo vertical autenticado;
- autenticação e isolamento por tenant;
- persistência de decisões e evidências;
- telemetria e governança contínuas;
- conector real e onboarding plug-and-play;
- runtime de release reproduzível;
- backup, restore e rollback;
- SLO, incidentes e capacidade;
- usabilidade e onboarding;
- segurança, privacidade e auditoria;
- oferta, preço, SLA e suporte;
- resultado validado por cliente.

Estados de evidência:

- `proven`: execução objetiva aprovada;
- `partial`: existe implementação ou documento, mas falta prova operacional;
- `missing`: não há evidência suficiente.

Documentação isolada nunca produz estado `proven`. Testes ignorados também não
contam como aprovação.

## Baseline de 07/09/2026

- score: **64/100**;
- estágio seguro: **design partners**;
- piloto pago: **NO-GO**;
- disponibilidade geral: **NO-GO**;
- estimativa para piloto pago: **14–23 pessoa-dias** ou **6–10 dias úteis** com
  cinco frentes realmente paralelas;
- estimativa para disponibilidade geral: **19–31 pessoa-dias** ou **15–24 dias
  úteis**, incluindo estabilização e aceite externo.

Evidência executada na baseline:

- 51 testes unitários frontend aprovados, sem skips;
- 278 testes unitários backend aprovados;
- 18 testes de integração PostgreSQL aprovados;
- 29 E2E autenticados aprovados, incluindo setup Clerk;
- 62 E2E públicos desktop/mobile aprovados;
- typecheck e build de produção aprovados.

O backend também reporta 18 testes ignorados no comando unitário padrão, mas os
mesmos cenários de integração foram executados separadamente contra PostgreSQL e
os 18 foram aprovados. O build gera um bundle JavaScript de aproximadamente
2,4 MB e permanece como risco de performance a ser tratado antes de GA.

## Bloqueadores do piloto pago

1. provar telemetria contínua em soak test de 24 horas;
2. homologar um conector externo real do onboarding ao relatório;
3. executar smoke em uma release publicada e imutável;
4. ensaiar backup, restore e rollback com tempo medido;
5. aprovar SLO, capacidade, alertas e runbook operacional;
6. fechar retenção, exportação/exclusão e threat model;
7. versionar a oferta comercial com ICP, escopo, preço, SLA e suporte.

Já é seguro iniciar discovery comercial e operar com design partners sob escopo
controlado. Ainda não é seguro anunciar disponibilidade geral ou assumir SLA de
produção sem concluir e reexecutar esses gates.
