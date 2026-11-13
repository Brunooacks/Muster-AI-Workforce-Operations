# Handoff: Muster · nova home + design system “Claro de decisão”

Data: 25/10/2026 · Repositório alvo: `Brunooacks/Muster-AI-Workforce-Operations` (`artifacts/cohort`, React + Vite + Tailwind 4 + tokens HSL em `src/index.css`).

## 1. Visão geral

Redesign da home pública do Muster e um sistema visual único para site e área logada. A home deixa de listar features e passa a contar, para quem decide (CFO, COO, CIO, board), o que o Muster resolve: todos os agentes de IA da empresa, de qualquer fornecedor, com objetivos, KPIs, custo, acompanhamento e um responsável.

Decisões já tomadas pelo Bruno durante o processo (não reabrir):
- Linguagem para decisores. Sem jargão (nada de policy, telemetria, KPI em camadas, nomes de produto de nuvem no texto corrido).
- O termo **“contrato” não existe mais**. Usar **objetivos, KPIs e limite** (“como um OKR”). A ficha do agente se chama **Ficha do agente** (no app, pode manter “Carteira de Trabalho” como nome de tela, mas a copy pública fala “ficha”).
- Tese: **“Cada plataforma cuida dos agentes que rodam nela. O Muster cuida de todos os seus.”** Não dizer “só os dele”: a AWS (AgentCore), por exemplo, aceita qualquer modelo e framework, mas governa apenas os agentes implantados nela.
- Paleta: branco, cinza-claro e tinta, um acento ciano, terracota para negativo. Sem verde-musgo, sem creme, sem azul de SaaS. Nada de referência a segurança (Zenity foi referência só de estrutura).
- Gartner aparece como fonte, com disclaimer de marca.

## 2. Sobre os arquivos

Os arquivos desta pasta são **referências de design feitas em HTML**: protótipos que mostram aparência e comportamento. Não são código de produção para copiar. A tarefa é **recriar a home em `artifacts/cohort/src/pages/landing.tsx`** com os componentes e padrões do repositório (shadcn/Tailwind, lucide, wouter, i18n em `src/lib/i18n`), e aplicar os tokens de `tokens.css` em `src/index.css` como novos perfis.

Fidelidade: **alta (hi-fi)** para a home. Cores, tipografia, espaçamento e copy são finais, salvo os pontos marcados como placeholder (seção 8).

## 3. Arquivos

| Arquivo | O que é |
| --- | --- |
| `Muster Home.dc.html` | A home final, **responsiva** (390px a 1280px+). Abra no navegador (precisa de `support.js` ao lado). |
| `tokens.css` | Perfis `claro` e `noite` no formato exato do `index.css` do repo. |
| `video/muster-intro/index.html` | Composição HyperFrames do vídeo de 53s (HTML → MP4 com `npx hyperframes render`). `preview.html` tem player. |
| `docs/screenshots/*.png` | Telas do app usadas no vídeo (junho/2026, tema antigo; regravar). |
| `referencia/Muster Redesign (board de exploracao).dc.html` | Histórico das 7 rodadas de exploração. Só consulta. |

## 4. Design system “Claro de decisão”

### 4.1 Cores (perfil `claro`, site e app em modo claro)

| Papel | Hex | Token | Uso |
| --- | --- | --- | --- |
| Fundo | `#ffffff` | `--background` | página |
| Superfície | `#f5f5f7` | `--secondary` / `--muted` | cartões cinza-claros, seções alternadas, fundo de pílulas |
| Tinta | `#1d1d1f` | `--foreground` / `--primary` | texto, botão principal (pílula preta), seção “O que resolvemos” (`#000`) e cartão “Para o board” |
| Texto secundário | `#6e6e73` | `--muted-foreground` | subtítulos, legendas |
| Texto terciário | `#a1a1a6` | — | rótulos pequenos, notas |
| Borda | `rgba(0,0,0,.06)` a `.12` | `--border` | linhas e contornos |
| Acento | `#19d3f5` | `--accent` / `--chart-1` | barra de progresso do vídeo, selo “Mais escolhido”, botão do plano em destaque, dado positivo |
| Negativo | `#b54f36` | `--destructive` / `--chart-3` | o “61%”, “40%+”, alertas |
| Atenção | `#e7aa40` | `--chart-2` | “aguarda decisão”, deltas negativos leves |
| Crítico | `#ff3d81` | `--chart-4` | só no app, alertas críticos |

Regra: **uma cor de ação por tela** (tinta no claro, ciano no escuro). O ciano nunca vira botão secundário.

Nota sobre o protótipo: dois CTAs (“Iniciar avaliação” no hero e no fechamento) ainda aparecem em verde `#397459`, resquício de uma rodada anterior. **Implementar em tinta `#1d1d1f`** (pílula preta, texto branco). Da mesma forma, os selos “ATIVA/AO VIVO” da ficha usam `#7fb89a`; implementar com `--chart-1` (ciano).

### 4.2 Cores (perfil `noite`, área logada em modo escuro)

Fundo `#06080d`, cartão `#0c1018`, texto `#eef2f7`, secundário `#8b94a7`, borda `rgba(255,255,255,.08)`, ação e positivo `#19d3f5`, atenção `#ffb020`, negativo `#ff3d81`. Grade sutil em ciano no fundo (ver `tokens.css`). Semântica dos `--chart-*` igual ao claro, então nenhum componente do app precisa saber qual perfil está ativo.

### 4.3 Tipografia

- Família única: **Geist** (Google Fonts, pesos 400/500/600). Substitui Spectral + Inter. `IBM Plex Mono` 400/500 só para rótulos de dado (`Nº 0417 · v3`, `FICHA DO AGENTE`, datas).
- Escala (desktop → mobile via `clamp`):
  - Display (H1 hero): 92px / .98 / `-0.05em` / 600 → `clamp(37px, 7.2vw, 92px)`
  - H2 de seção: 56–60px / 1.05 / `-0.04em` / 600 → `clamp(24px, 4.4vw, 56px)`
  - H3 de cartão: 36–40px / 1.08 / `-0.03em` / 600
  - Frase de produto: 30px / 1.25 / `-0.025em` / 500
  - Corpo grande: 20–21px / 1.45 / 400 · corpo: 15–16px / 1.5 · nota: 12–13px
  - Números grandes: 80px (tendências), 150–180px (98%/61%), 48px (preço) com `letter-spacing: -0.06em`
- `text-wrap: balance` em títulos; `-webkit-font-smoothing: antialiased`.

### 4.4 Espaçamento, raios, sombras

- Grade de 8px. Padding lateral de seção `clamp(20px, 5vw, 48px)`; padding vertical 96–120px (desktop), 64px (mobile).
- Largura máxima de conteúdo 1152px; página 1280px centralizada.
- Raios: pílulas `999px`; cartões pequenos `12–20px`; cartões grandes e vídeo `24–32px`; ficha do agente `28px`.
- Sombras: ficha e vídeo `0 50px 100px -30px rgba(0,0,0,.45)`; cartão de recomendação `0 10px 40px -20px rgba(0,0,0,.2)`.
- Botões: pílula, `padding 12px 24px`, 15–18px/500. Primário tinta/branco; secundário texto tinta com `›`.
- Seletor segmentado: fundo `rgba(0,0,0,.06)`, raio 24px (quebra linha no mobile), item ativo branco com `0 1px 4px rgba(0,0,0,.12)`.

## 5. Estrutura da home (ordem e conteúdo exato)

1. **Barra de navegação** (sticky, 52px, fundo `rgba(255,255,255,.85)` + blur): marca (MusterMark em tinta + “Muster”) · Como funciona · Acompanhamento · Decisão · Board · Integrações · Entrar · botão “Iniciar avaliação”. No mobile os links quebram linha ou viram menu.
2. **Hero** (centralizado, padding-top 96px):
   - H1: **Seus agentes de IA já decidem.** *(linha 2 em `#6e6e73`)* **Quem responde por eles?**
   - Frase de produto (30px/500): **Muster: todos os seus agentes de IA, com objetivos, KPIs e um responsável.**
   - Parágrafo (21px, `#6e6e73`, máx. 680px): **Onde quer que eles rodem, o Muster mostra em um só lugar o que cada agente deve entregar, quanto custa, se está entregando e quem responde por ele.**
   - Linha de logos oficiais em cinza (AWS, Microsoft Azure, Google Cloud, Salesforce, OpenAI, Anthropic, ServiceNow) + “+ agentes feitos em casa”. Altura 16–26px, `filter: grayscale(1); opacity: .7`, gap 26px, quebra linha.
   - Botões: “Iniciar avaliação” (primário) · “Ver como funciona ›”.
3. **Vídeo interativo** (16:9, máx. 1152px, raio 24px, fundo `#06080d`, barra de progresso ciano 4px): o vídeo de 53s renderizado como MP4 (ou mantido como composição HTML). Abaixo: botão “▶ Assistir / ❚❚ Pausar” + 7 capítulos clicáveis que buscam o tempo: Abertura 0s · Todas as plataformas 5s · Visão geral 12s · Objetivos e KPIs 18s · Alerta 25s · Decisões 32s · Começar 43s. Legenda: “53 segundos · clique em um capítulo para pular · telas do produto”.
4. **O que o mercado já sabe** (fundo branco): H2 **Os agentes vão decidir mais. Quatro em cada dez projetos vão ser cancelados.** Três cartões `#f5f5f7` (raio 24px, padding 40/36):
   - **15%** · das decisões do dia a dia serão de agentes de IA até 2028. · Em 2024, zero. · Gartner, jun/2025
   - **33%** · dos softwares corporativos terão agentes embutidos até 2028. · Em 2024, menos de 1%. · Gartner, jun/2025
   - **40%+** (em `#b54f36`) · dos projetos com agentes serão cancelados até 2027. · Custo alto, valor pouco claro, controle fraco. · Gartner, jun/2025
   - Nota 13px `#a1a1a6`: “Gartner é marca registrada da Gartner, Inc. Previsões de comunicados públicos (jun/2025). Não há endosso do Muster.”
5. **O que resolvemos** (fundo `#000`, texto `#f5f5f7`, padding 120px): H2 **Quatro perguntas que hoje ficam sem resposta.** Grade 2×2 com borda `#2a2a2e`, raio 20px; cada célula: número mono (`01`), pergunta 28px/600, explicação 16px `#a1a1a6`, linha final em ciano “Muster: …”:
   - 01 Quantos agentes estão rodando e o que cada um pode fazer? · Times diferentes ligaram agentes em sistemas diferentes. Não existe uma lista. · **Muster:** uma ficha por agente, com objetivo e limite.
   - 02 Eles estão entregando resultado ou só concluindo tarefas? · O painel do agente diz 98%. O resultado para o negócio, ninguém mede. · **Muster:** mede tarefa e resultado, e avisa quando divergem.
   - 03 Quem responde quando um agente erra? · Hoje a resposta é “o fornecedor”, “a TI” ou silêncio. · **Muster:** cada agente tem um responsável humano por escrito.
   - 04 O que você diz ao board? · Não há relatório, só prints de painéis que ninguém sabe ler. · **Muster:** um relatório mensal de uma página, com origem dos números.
6. **Objetivos e KPIs por agente** (fundo degradê branco → `#f5f5f7`): H2 **Cada agente tem uma ficha, como um funcionário.** Seletor segmentado com 4 estados que alteram selo, opacidade dos campos e legenda: Identidade (“ATIVA”) · Objetivos e KPIs (“METAS DO TRIMESTRE”) · Acompanhamento (“AO VIVO”) · Decisão (“AGUARDA MARINA”). A **ficha** é um cartão escuro (620px máx., raio 28px, degradê `#2a2a2e → #141416 → #1f1f23`, texto `#f5f5f7`) com: rótulo mono `FICHA DO AGENTE` · `Nº 0417 · v3` · MusterMark; avatar “S”, **Sofia**, “Atendimento N1 · Zendesk”; três campos: OBJETIVO “Resolver 90% dos chamados de 1º nível sem escalar”, LIMITE “Reembolsa até R$ 500 sozinha”, RESPONSÁVEL “Marina Alves · CX”; três KPIs com barra ciano: Qualidade 93%, Resultado real 91%, Evidência 96%. Abaixo, quatro legendas (Identidade / Objetivo e limite / Responsável / KPIs e evidência) em grade que empilha no mobile; legenda da aba ativa em 19px. Nota “DADOS ILUSTRATIVOS”.
7. **Acompanhamento** (branco): H2 **Concluir a tarefa não é entregar o resultado.** Sub: **O Muster mede os dois. E avisa quando um esconde o outro.** Cartão `#f5f5f7` (960px, raio 32px) com seletor “Tarefas concluídas / Resultado real” que alterna o número gigante **98%** (tinta, “Meta de reuniões batida.”) ↔ **61%** (`#b54f36`, “Mas o resultado não veio.”), alterna sozinho a cada 4,2s.
8. **Decisão com dono** + **Para o board** (duas colunas, empilham no mobile): esquerda `#f5f5f7` com H3 **O Muster recomenda. Uma pessoa decide.**, texto “Cada recomendação chega com evidência, prazo e um nome.” e cartão branco: `PARA MARINA ALVES · ATÉ 30/08` · “Ampliar o limite da Sofia para R$ 1.000 em reembolsos de baixo risco.” · “Evidência: 1.284 atendimentos · 0 fora da política · 96% de qualidade” · botões Aprovar (tinta) / Ajustar / Rejeitar. Direita `#1d1d1f`: H3 **Um relatório por mês. Em uma página.**, “O que mudou, por quê, o que está em risco e quem cuida.” e quatro números: 92% Propósito +4 · 86% Saúde +2 · 94% Evidência +7 · 78% Governança −3 (deltas em `--chart-1`/`--chart-2`).
9. **Integrações**: H3 **Funciona onde seus agentes já estão.** Pílulas contornadas: Zendesk, Salesforce, HubSpot, Snowflake, Notion AI, Kubernetes, Docker, vLLM, AWS, Azure, GCP, On-premise. Nota: “Na nuvem ou no seu servidor · dados isolados por empresa · tudo auditável”.
10. **Preços** (branco): H2 **Preço fixo por empresa. Sem cobrança por usuário.** Sub: “Três planos, por porte de empresa. Agentes adicionais quando precisar.” Seletor Mensal / “Anual · 2 meses grátis”. Três cartões (grade auto-fit ≥280px, raio 24px):
    - **Startups** (`#f5f5f7`) · Até 2 anos de CNPJ ou até R$ 4,8 mi/ano e 20 pessoas · **Grátis ou R$ 199** por mês · preço válido por 24 meses (anual: **Grátis ou R$ 1.990** por ano · 2 meses grátis) · “Para provar valor desde o primeiro agente.” · Grátis: 2 agentes e 30 dias de histórico · Startup: 5 agentes e 90 dias de histórico · Relatório mensal de entregas (plano pago) · Agente adicional: R$ 39/mês · Suporte por comunidade e e-mail · botão “Começar grátis” · “Sem cartão.”
    - **Pequenas e Médias Empresas** (cartão tinta `#1d1d1f`, selo ciano **MAIS ESCOLHIDO**) · Até R$ 300 mi/ano ou 500 pessoas · **R$ 690** por mês (anual **R$ 6.900**) · “Para quem já tem agentes em produção.” · Até 25 agentes e 15 usuários · 12 meses de histórico · Relatório mensal de entregas · Agente adicional: R$ 29/mês · Suporte por e-mail em 1 dia útil · botão ciano “Testar 14 dias grátis” · “Sem cartão.”
    - **Grandes Empresas** (`#f5f5f7`) · Acima disso, ou quem precisa de contrato, SSO ou SLA · **a partir de R$ 2.990** por mês, sob contrato (anual: “contrato anual”) · “Para operações em escala, com SLA e auditoria.” · A partir de 50 agentes, usuários ilimitados · 24 a 36 meses de histórico · Relatório mensal + auditoria trimestral · Agente adicional: a partir de R$ 19/mês · Canal dedicado com SLA · botão “Falar com a equipe” · “Piloto de 30 dias por R$ 990, abatido no contrato anual.”
    - Rodapé 14px: “Sem cobrança surpresa: aviso aos 80% do limite; acima de 100%, 30 dias de coleta antes de você escolher. Auditoria avulsa: R$ 490 (inclusa em Grandes Empresas).”
11. **Fechamento** (`#f5f5f7`, padding 120px): H2 **Comece pelo agente que mais preocupa você.** · “Em 30 dias: objetivos, KPIs, acompanhamento e o primeiro relatório para o board.” · “Iniciar avaliação” (primário) · “Falar com a equipe ›”.
12. **Rodapé**: “Muster · AI Workforce Operations” · “Identidade · Evidência · Decisão · Responsabilidade”.

## 6. Interações e estado

| Estado | Tipo | Comportamento |
| --- | --- | --- |
| `cardTab` 0–3 | seletor da ficha | troca selo, legenda e opacidade dos campos (`1` ativo / `.45` demais), transição 300–400ms |
| `v` 0–1 | seletor 98%/61% | alterna número, título e cor; autoplay a cada 4,2s (pausa quando o usuário clica) |
| `annual` bool | preços | troca preço e nota de cada plano |
| `vidT`, `vidOn` | vídeo | play/pausa via `requestAnimationFrame`; capítulos fazem seek; barra de progresso em % |
| `vidScale` | vídeo | `ResizeObserver` escala o player 1920×1080 para a largura do contêiner |

Transições: `all .3s` nos seletores, `opacity .4s` nos campos da ficha, `color .5s` no número grande. Sem animações de entrada no scroll (pode adicionar fade-up leve de 400ms se o time quiser).

Responsivo: grades `repeat(auto-fit, minmax(…))` (200/250/290px), tipografia com `clamp`, seletores com `flex-wrap`, ficha com altura natural (nunca `aspect-ratio` fixo no mobile). Testado em 390, 924 e 1280px.

## 7. Área logada: o que muda

- Adotar `tokens.css`: perfis `claro` (padrão) e `noite`. Remover o tema Ops Room (verde) e os perfis âmbar/ardósia/solarizado/grafite/papel, ou mantê-los como legado desligados.
- Trocar `--app-font-serif` (Spectral) por Geist; títulos de página em Geist 600 com `letter-spacing -0.03em`.
- Renomear na interface: “Contrato profissional” → **Objetivos e KPIs**; “Carteira de Trabalho” pode continuar como nome da tela, com subtítulo “Objetivos, KPIs e responsável”.
- Status: ativo/no alvo = `--chart-1`, atenção/corrigir = `--chart-2`, fora da meta = `--chart-3`, crítico = `--chart-4`. Vereditos em linguagem de decisão: **Ampliar · Corrigir · Observar · Desligar**.
- Cada tela responde com número para quem decide: custo/mês somado, quantos agentes têm responsável, valor em decisões pendentes.

## 8. Placeholders e pendências

- Dados da home (Sofia, Atlas, 98%/61%, 92/86/94/78, 1.284 atendimentos) são ilustrativos; manter a nota “Dados ilustrativos” ou trocar por dados reais.
- Logos: arquivos públicos do Wikimedia Commons. Confirmar diretrizes de marca de cada empresa antes de publicar.
- Previsões Gartner: comunicado de 25/06/2025 (“Gartner Predicts Over 40% of Agentic AI Projects Will Be Canceled by End of 2027”). Manter o disclaimer.
- Vídeo: composição pronta em `video/muster-intro`; está na paleta escura e usa telas de junho. Regravar as telas no perfil `claro` ou `noite` e renderizar com `npx hyperframes render`. Sem música/locução.
- Textos em EN/ES: ainda não traduzidos; seguir a estrutura do dicionário `L` em `landing.tsx`.

## 9. Assets

- `MusterMark` (três chevrons) já existe em `src/components/logo.tsx`; usar com `stroke: currentColor` em tinta (claro) ou ciano (noite).
- Fontes: Geist e IBM Plex Mono via Google Fonts (ou self-host em `public/fonts`).
- Ícones: lucide-react, traço 1.75, só onde já existem no app; a home não usa ícones decorativos.
