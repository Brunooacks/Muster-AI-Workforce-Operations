# Fontes dos números públicos

Regra R6 da cunha (MUS-179): número em texto público (landing, calculadora,
material de pitch publicado) só entra com **fonte pública verificada e link**
nesta página. Sem fonte, o texto vai sem atribuição ou sem o número.

## Dados de mercado citados nos textos públicos

Nenhum, hoje. A landing não cita estatística de mercado.

Os três dados listados na regra R6 (`specs/004-cunha/spec.md`) não têm fonte
pública e foram retirados de todos os textos públicos; o teste
`artifacts/cohort/src/lib/landing-scan.test.ts` falha se algum deles voltar.

## Números de exemplo (sem fonte, por definição)

Os números dos cards da landing (Board Brief, fechamento mensal, ticker de
vereditos e visão geral do Workforce OS) são **ilustrativos**: mostram como o
Muster apresenta um fechamento. Ficam em
`artifacts/cohort/src/pages/landing-examples.ts` e aparecem sempre com o selo
"Exemplo" / "Example" / "Ejemplo". Não são dados de clientes nem de mercado e
não devem ser citados como tais.

## Como adicionar um número

1. Ache a fonte primária pública (relatório, paper, página oficial) e confira
   o número e a data no próprio documento.
2. Adicione aqui: o número exatamente como aparece no texto, o link, a data de
   acesso e quem verificou.
3. Só então use o número no texto público, com a atribuição.

| número no texto | fonte (link) | acesso | verificado por |
|---|---|---|---|
| — | — | — | — |
