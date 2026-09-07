# Demo local do Muster — passo a passo

Guia para rodar o Muster na sua máquina, simular a **sua** frota de agentes e
chegar a uma decisão em cima de dados observados. Do zero à primeira decisão em
cerca de 10 minutos.

---

## Antes de começar

Você precisa de três coisas instaladas:

| O quê | Como conferir | Se faltar |
| --- | --- | --- |
| Node.js 24+ | `node --version` | https://nodejs.org |
| pnpm | `pnpm --version` | `npm install -g pnpm` |
| Docker | `docker info` | Docker Desktop |
| Projeto Clerk | chaves `pk_test_...` e `sk_test_...` | https://dashboard.clerk.com |

> Se `docker info` travar ou demorar mais de um minuto, abra o Docker Desktop e
> espere a baleia ficar verde antes de seguir.

---

## Passo 1 — Baixar e instalar

```bash
git clone https://github.com/Brunooacks/Muster-AI-Workforce-Operations.git
cd Muster-AI-Workforce-Operations
pnpm install
```

**O que esperar:** o pnpm baixa as dependências do monorepo. Na primeira vez
demora alguns minutos; nas seguintes, segundos.

---

## Passo 2 — Subir o banco

```bash
docker compose up -d postgres
```

**O que esperar:** um container `muster-postgres` no ar, na porta 5433.

Confira:

```bash
docker ps --filter name=muster-postgres
```

Deve aparecer `Up ... (healthy)`. Se disser `starting`, espere dez segundos e
repita — o Postgres ainda está inicializando.

---

## Passo 3 — Criar as tabelas

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/muster" \
  pnpm --filter @workspace/db run migrate
```

**O que esperar:** `migrations applied successfully!`

Isso cria o schema completo, incluindo a organização de acolhimento que recebe
os dados enquanto você opera com um único cliente.

---

## Passo 4 — Configurar o ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
cat > .env <<'FIM'
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/muster
PORT=8087
NODE_ENV=development
CLERK_SECRET_KEY=sk_test_SUBSTITUA
CLERK_PUBLISHABLE_KEY=pk_test_SUBSTITUA
VITE_CLERK_PUBLISHABLE_KEY=pk_test_SUBSTITUA
WEB_APP_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173
AI_INTEGRATIONS_OPENAI_BASE_URL=http://localhost:9/unused
AI_INTEGRATIONS_OPENAI_API_KEY=dummy-local
FIM
```

**Por que cada linha importa:**

- As três variáveis Clerk são obrigatórias. A API não inicia sem as chaves de
  backend e o frontend mostra um erro de configuração sem a publishable key.
- `WEB_APP_URL` e `CORS_ALLOWED_ORIGINS` limitam quais aplicações web podem
  enviar credenciais para a API.
- As duas variáveis de OpenAI são valores de descarte. A telemetria e a
  avaliação **não** usam IA — só a análise opcional de repositório usa, e ela
  não faz parte deste roteiro.
- A porta 8087 evita conflito com a 8080, que o Docker costuma ocupar.

---

## Passo 5 — Subir a API

Em um terminal, deixe rodando:

```bash
set -a && . ./.env && set +a
pnpm --filter @workspace/api-server run dev
```

**O que esperar:** a API compila e passa a escutar em `http://localhost:8087`.

Confira em outro terminal:

```bash
curl -s http://localhost:8087/api/healthz
```

Deve devolver `{"status":"ok"}`. Já `GET /api/agents` sem sessão deve retornar
`401`, inclusive em desenvolvimento.

---

## Passo 6 — Subir a interface

Em um **segundo** terminal, deixe rodando:

```bash
set -a && . ./.env && set +a
API_PROXY_TARGET=http://localhost:8087 pnpm --filter @workspace/muster run dev
```

No dashboard do Clerk, habilite **Organizations**, crie uma organização de
teste e adicione o usuário. Abra **http://localhost:5173**, entre e escolha essa
organização no seletor. O frontend chama
`POST /api/organizations/active/sync`: a API valida o vínculo diretamente no
Clerk, cria ou atualiza o tenant local e semeia seu catálogo. Não insira
`organization_members` manualmente e não envie um `orgId` pelo cliente.

A landing permanece pública; as demais páginas exigem sessão e organização
ativa.

---

## Passo 7 — Simular a sua frota

Aqui o Muster deixa de ser uma tela e passa a ser uma decisão.

Com o usuário autenticado, abra o console do navegador e copie um token curto
da sessão com `copy(await window.Clerk.session.getToken())`. Exporte-o no
terminal que executará os scripts:

```bash
export MUSTER_AUTH_TOKEN='cole-o-token-Clerk-aqui'
```

```bash
pnpm --filter @workspace/scripts run demo
```

Para uma demonstração completa, com seis agentes em plataformas e domínios
distintos mais uma jornada A2A de cinco subagentes, execute:

```bash
pnpm --filter @workspace/scripts run demo:complete
```

Se quiser criar apenas o portfólio profissional multissetorial, use
`pnpm --filter @workspace/scripts run demo:workforce`.

**O que acontece, em ordem:**

1. Cada agente do cenário é **admitido** com carteira de trabalho.
2. Cada um recebe uma **credencial própria** (`msk_live_...`) — é assim que um
   agente reporta em produção, sem carregar a sessão de nenhuma pessoa.
3. Trinta dias de execuções são reportados **usando essa credencial**.
4. A plataforma **reavalia** e emite o veredito.

**O que esperar na saída:**

```
Agente                 Comportamento  Eventos  Saúde  Veredito  Fonte
─────────────────────  ─────────────  ───────  ─────  ────────  ─────────
Triagem N1             estável        770      76     mentor    telemetry
Redator de Respostas   em degradação  913      62     mentor    telemetry
Fechamento de Chamado  instável       1244     38     retire    telemetry
```

Repare em `Fonte: telemetry`. Se aparecesse `none`, seria porque o agente não
tem evidência — e nesse caso a plataforma se recusa a dar nota, em vez de
inventar um número.

---

## Passo 8 — Ver e decidir na interface

Volte ao navegador:

1. **Comando** — decisões pendentes, alertas e saúde consolidada da frota.
2. **Agentes** — clique no agente que recebeu `retire`.
3. Na página dele, percorra de cima para baixo:
   - **Carteira de Trabalho** — papel, o que deve e não deve fazer, donos.
   - **Avaliação de Desempenho** — as cinco camadas com meta por métrica.
   - **Telemetria Operacional** — execuções, taxa de sucesso, latência p95,
     custo e escalações; troque a janela entre 7, 30 e 90 dias.
   - **Recomendação para o Comitê** — o veredito com confiança, plano de ação
     com responsável e prazo, e os botões de **aprovar** ou **discordar**.

Decida ali. A decisão fica registrada com autor, data e a evidência que a
sustentou — é isso que uma auditoria pede depois.

---

## Passo 9 — Enquadrar no seu cenário

Este é o passo que transforma a demo em conversa sobre a sua operação.

Copie o cenário de exemplo e edite:

```bash
cp scripts/scenarios/suporte-tecnico.json scripts/scenarios/meu-cenario.json
```

Abra o arquivo e descreva os **seus** agentes:

```json
{
  "cenario": "Minha operação",
  "agentes": [
    {
      "nome": "Revisor de Pull Request",
      "papel": "Revisa PRs e sugere correções antes do humano",
      "plataforma": "langgraph",
      "vertical": "engenharia",
      "comportamento": "degradando",
      "execucoesPorDia": 80,
      "custoPorExecucaoCentavos": 12,
      "deveFazer": ["Apontar risco de regressão", "Sugerir teste faltante"],
      "naoDeveFazer": ["Aprovar PR sem revisão humana"],
      "metricas": [
        { "camada": "efficacy",   "label": "Defeito escapado para produção", "unidade": "%", "meta": "≤ 3%" },
        { "camada": "efficiency", "label": "Tempo de revisão",               "unidade": "s", "meta": "< 90 s" },
        { "camada": "adoption",   "label": "PRs revisados por dia",          "unidade": "/dia", "meta": "≥ 40" }
      ]
    }
  ]
}
```

Rode o seu cenário:

```bash
pnpm --filter @workspace/scripts run demo -- --cenario=meu-cenario
```

**Campos que você vai querer mexer:**

| Campo | O que faz |
| --- | --- |
| `comportamento` | `saudavel`, `degradando` ou `erratico` — governa a curva de sucesso, erro e custo ao longo da janela |
| `metricas[].camada` | `efficacy` (resolve?), `efficiency` (é viável?), `adoption` (usam?), `governance` (é seguro?), `value` (vale?) |
| `metricas[].meta` | A régua. Aceita `≥ 85%`, `≤ 2%`, `< 3 s`, faixas como `R$ 0,10–0,40` |
| `execucoesPorDia` | Volume — afeta diretamente a camada de adoção |

Outras opções úteis:

```bash
# janela diferente
pnpm --filter @workspace/scripts run demo -- --cenario=meu-cenario --dias=90

# limpar a frota do cenário ao final
pnpm --filter @workspace/scripts run demo -- --limpar
```

---

## Passo 10 — Provar que o ciclo se sustenta sozinho

```bash
pnpm --filter @workspace/scripts run e2e
```

Um agente validador percorre o ciclo inteiro pela API pública — cria a frota,
reporta telemetria, reavalia, decide no comitê, confere a trilha de auditoria e
limpa tudo. Ele falha alto se qualquer invariante quebrar, por exemplo se um
agente em degradação receber promoção.

É o teste que garante que a demo continua verdadeira depois de cada mudança.

---

## Se algo der errado

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `ECONNREFUSED ... 5433` | Postgres não subiu | `docker compose up -d postgres` e aguardar `healthy` |
| Comandos `docker` travam | Docker Desktop engasgado | Reiniciar o Docker Desktop e esperar |
| `API respondeu 401` no demo | token Clerk ausente ou expirado | Gere outro token no navegador e exporte `MUSTER_AUTH_TOKEN` |
| `API respondeu 403` após login | usuário sem organização ativa | Crie/associe a organização no Clerk e selecione-a no switcher |
| `Porta 8087 em uso` | Outra instância rodando | `lsof -ti:8087 \| xargs kill` |
| Tela de onboarding sempre volta | Estado do navegador | Clicar em **Pular configuração** |
| Veredito sai como `Fonte: none` | Agente sem telemetria | Rodar o passo 7 — é o comportamento correto, não um erro |

---

## O que esta demo mostra, e o que ainda não

**Mostra, com dado observado:** identidade e carteira de cada agente, avaliação
em cinco camadas sob as lentes de produtividade e propósito, telemetria real com
credencial por agente, veredito auditável com plano de ação, e decisão do comitê
registrada.

**Ainda não faz:** conectar sozinho na sua conta AWS, Azure ou GCP para
descobrir e coletar agentes. Hoje a coleta é *push* — o agente reporta, via SDK
ou REST, em qualquer linguagem. Coleta *pull* nas nuvens está no roadmap, e é um
trabalho de outra ordem de grandeza.

Vale dizer isso abertamente numa conversa técnica: a diferença entre "recebemos
telemetria de qualquer plataforma" e "conectamos na sua nuvem" é exatamente o
tipo de distinção que uma tech lead vai querer ouvir com clareza.
