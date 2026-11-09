<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="artifacts/cohort/public/brand/muster-lockup-on-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="artifacts/cohort/public/brand/muster-lockup-on-light.svg">
  <img alt="Muster Workforce Operations" src="artifacts/cohort/public/brand/muster-lockup-on-light.svg" width="340">
</picture>

# Muster Workforce Operations

**Atividades triviais e repetitivas vão para os agentes. As pessoas ficam com o que exige julgamento.**

</div>

---

## O que é

O Muster Workforce Operations organiza o trabalho entre a equipe e os agentes de IA da empresa. Ele **não substitui pessoas**: direciona aos agentes as atividades triviais e repetitivas, mede o resultado com dados da própria operação e, quando um agente não atende, a atividade é **devolvida para a equipe**.

O que a plataforma acompanha:

- **Direcionamento:** quais atividades vão para os agentes e quais ficam com a equipe.
- **Baseline humano:** horas produtivas da equipe (declaradas ou medidas) como base de comparação.
- **Resultado:** custo, prazo e qualidade por atividade validada. O comparativo com o trabalho humano só aparece em destaque com cobertura de baseline suficiente.
- **Squads mistos:** pessoas e agentes no mesmo time, com a decisão sempre sob responsabilidade da equipe.
- **Privacidade:** dados por pessoa agregados por equipe. A visão individual depende de consentimento (LGPD). Conta empresa e conta pessoal são separadas.

## Status atual

Publicado em **https://muster.veltrixplatform.com**. A `main` é o que roda em produção (atualizada em 31/10/2026):

- Base das releases de 26 a 30/10: home nova, área logada (Fases 1 e 2), login, glossário, onboarding sem loop (RG-N03), `/design-system` fora de produção (RG-N20).
- **#71** (e1093bf): home sem "em breve", preços fora até decisão, login sem GitHub (RG-N29).
- **P0 tenancy** (4011543): rotas `:id` herdam o escopo da organização; outra organização recebe 404 (MU-09/MU-10, RG-X02).
- **Imagem sha-1490459** (commit reconstituído a partir da árvore publicada, que não estava em nenhum repositório): calculadora de custo por caso (RG-M02), `/en`, `/es`, `/pt` (RG-M05), rollup de métricas 30d (RG-M12), `requireOrg` com duas organizações (RG-X01).
- **RG-M08** (31/10): `/sign-up` mostra a regra de senha antes do envio (mínimo de 15 caracteres, a regra configurada no Clerk).

Pendentes: chaves do Clerk de produção (decisão 16A/16B), moeda e LGPD (exigem migração de schema, não aplicadas), evento do gateway Veltrix medido no Muster (RG-M17).

## Temas e idiomas

- **Temas:** Claro (padrão) e Noite (escuro). A escolha fica salva no navegador (`muster:profile`).
- **Idiomas:** português, inglês e espanhol (`muster:lang`). Cada tela mantém o próprio dicionário ao lado do código (`src/lib/i18n.tsx`). O nome "Muster Workforce Operations" não é traduzido.

## Entrar e criar conta

As telas `/sign-in` e `/sign-up` usam os componentes do Clerk com a aparência do sistema visual (`artifacts/cohort/src/muster/auth/`). Opções:

- **E-mail corporativo**, com código de verificação e/ou senha, conforme a configuração do Clerk.
- **Google** (Gmail e Google Workspace).

GitHub saiu da tela de login no #71. Google aparece quando está ativado no Clerk com credenciais próprias (OAuth). Senha: mínimo de 15 caracteres, mostrado no `/sign-up` antes do envio. Agentes não usam esse login: têm credenciais próprias, limitadas por empresa e por regra.

## Como rodar localmente

Requisitos: Node 24, pnpm 9 e Docker.

```bash
pnpm install
cp .env.example .env            # preencha com chaves de TESTE do Clerk (pk_test/sk_test)
docker compose up -d postgres
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/api-server run dev
API_PROXY_TARGET=http://localhost:8087 pnpm --filter @workspace/muster run dev
```

Validação: `pnpm run typecheck`, `pnpm test` e `pnpm --filter @workspace/muster run test:e2e`. O passo a passo completo está em [docs/DEMO-LOCAL.md](docs/DEMO-LOCAL.md).

## Deploy

- **Manual.** Este repositório não usa GitHub Actions.
- Produção em **https://muster.veltrixplatform.com**: front e API em containers (Docker Compose) atrás de um proxy com HTTPS, sem portas públicas além do proxy.
- Segredos ficam só no servidor, fora do git. Nunca registre chaves, senhas ou endereços de servidor neste repositório.
- Merge na `main` e deploy de produção só com aprovação explícita do responsável pelo produto.
- Antes de cada deploy: conferir que todos os PRs aprovados são ancestrais do commit publicado (manifesto da release) e comparar prints 1280/390 com o protótipo aprovado.

## Estrutura

| Pasta | Conteúdo |
| :--- | :--- |
| `artifacts/cohort` | Front (React + Vite), pacote `@workspace/muster` |
| `artifacts/api-server` | API (Express) |
| `artifacts/agent-runner` | Execução e coleta dos agentes |
| `lib/` | Banco (Drizzle/Postgres), cliente da API e bibliotecas compartilhadas |
| `docs/` | Runbooks, validações e decisões |
