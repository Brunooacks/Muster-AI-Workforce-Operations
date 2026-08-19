/**
 * Integração de um agente isolado, passo a passo e ao vivo.
 *
 * Serve para demonstrar a integração em si — não o resultado dela. Cada passo
 * é narrado e pausado, e os eventos entram devagar de propósito: com a tela
 * atualizando sozinha a cada 5s, dá para deixar o navegador aberto na página do
 * agente e ver os números preencherem enquanto se fala.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run demo:integrar
 *   pnpm --filter @workspace/scripts run demo:integrar -- --nome="Revisor de PR" --papel="Revisa pull requests" --execucoes=20
 */

/**
 * Perfis plausíveis para quando nenhum nome é informado. Demonstrar duas vezes
 * o mesmo "Agente de Integração" enfraquece a demo; variar dá a sensação de
 * frota real e permite ensaiar quantas vezes for preciso.
 */
const PERFIS: Array<{ nome: string; papel: string; plataforma: string }> = [
  { nome: "Triagem de Chamados", papel: "Classifica e roteia chamados de primeiro nível", plataforma: "openai-agents" },
  { nome: "Analista de Contratos", papel: "Lê contratos e sinaliza cláusulas de risco", plataforma: "langgraph" },
  { nome: "Conciliador Financeiro", papel: "Concilia lançamentos e aponta divergências", plataforma: "crewai" },
  { nome: "Qualificador de Leads", papel: "Qualifica leads de entrada e agenda contato", plataforma: "agentforce" },
  { nome: "Revisor de Pull Request", papel: "Revisa PRs e aponta risco de regressão", plataforma: "langgraph" },
  { nome: "Assistente de Onboarding", papel: "Conduz o onboarding de novos colaboradores", plataforma: "azure-ai-foundry" },
  { nome: "Detector de Fraude", papel: "Avalia transações e sinaliza suspeita de fraude", plataforma: "aws-bedrock-agentcore" },
  { nome: "Redator de Resposta", papel: "Redige respostas a partir da base de conhecimento", plataforma: "openai-agents" },
  { nome: "Auditor de Conformidade", papel: "Verifica aderência a política e registra desvio", plataforma: "google-vertex-agent-engine" },
  { nome: "Priorizador de Backlog", papel: "Ordena o backlog por impacto e esforço", plataforma: "langgraph" },
];

function arg(nome: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (hit) return hit.slice(nome.length + 3);
  return process.argv.includes(`--${nome}`) ? "true" : undefined;
}

const baseUrl = (arg("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");
// Sorteia um perfil ainda não usado — a checagem contra a frota acontece no
// main(), onde a lista já foi carregada.
const perfilSorteado = PERFIS[Math.floor(Math.random() * PERFIS.length)]!;
const nomeInformado = arg("nome");
const papel = arg("papel") ?? perfilSorteado.papel;
const plataforma = arg("plataforma") ?? perfilSorteado.plataforma;
const execucoes = Number(arg("execucoes") ?? 24);
const intervalo = Number(arg("intervalo") ?? 700);

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${texto.slice(0, 300)}`);
  return (texto ? JSON.parse(texto) : undefined) as T;
}

function titulo(n: number, t: string): void {
  console.log(`\n\x1b[1m${n}. ${t}\x1b[0m`);
  console.log("   " + "─".repeat(t.length + 3));
}

async function main(): Promise<void> {
  console.log(`\n\x1b[1m▸ Integrando um agente ao Muster\x1b[0m`);
  console.log(`  Deixe a página do agente aberta no navegador: ela atualiza sozinha.\n`);

  // ── 1. Cadastro ─────────────────────────────────────────────────────────
  titulo(1, "Cadastro — a carteira de trabalho");
  console.log(`   Papel:      ${papel}`);
  console.log(`   Plataforma: ${plataforma}`);

  const frota = await api<Array<{ id: string; name: string }>>("/agents");

  // Sem --nome: procura um perfil que ainda não está na frota. Se todos já
  // existirem, numera para continuar criando agentes distintos.
  let nome = nomeInformado ?? "";
  if (!nome) {
    const usados = new Set(frota.map((a) => a.name));
    const livre = PERFIS.find((p) => !usados.has(p.nome));
    nome = livre
      ? livre.nome
      : `${perfilSorteado.nome} ${frota.filter((a) => a.name.startsWith(perfilSorteado.nome)).length + 1}`;
  }
  console.log(`   Nome:       ${nome}`);

  const existente = frota.find((a) => a.name === nome);
  const agentId = existente
    ? existente.id
    : (await api<{ agent: { id: string } }>("/agents", {
        method: "POST",
        body: JSON.stringify({
          name: nome, role: papel, platform: plataforma, version: "1.0.0",
          bio: `${papel}. Integrado ao Muster para acompanhamento contínuo.`,
          tagline: papel,
          shouldDo: ["Executar a tarefa do papel declarado", "Reportar cada execução"],
          shouldNotDo: ["Executar ação irreversível sem aprovação humana"],
          autonomyLevel: "escalates",
          autonomyNotes: "Decisão final permanece humana durante o acompanhamento.",
          limits: ["Sem acesso a dado sensível fora do escopo"],
          businessOwner: "Dono de negócio (a definir)",
          technicalOwner: "Dono técnico (a definir)",
          governanceSponsor: "Comitê de Governança",
          baseline: "Primeira janela de observação em curso.",
          targetPayback: "A definir",
          businessCaseDescription: `Acompanhar ${nome} sob produtividade e propósito.`,
          proposedMetrics: [
            { layer: "efficacy", label: "Taxa de sucesso", unit: "%", target: "≥ 90%", value: 0 },
            { layer: "efficiency", label: "Tempo de resposta", unit: "s", target: "< 3 s", value: 0 },
          ],
        }),
      })).agent.id;

  console.log(
    existente
      ? `   → \x1b[33mjá existia — reaproveitando e somando execuções\x1b[0m (${agentId})`
      : `   → \x1b[32madmitido\x1b[0m (${agentId})`,
  );
  console.log(`   \x1b[2mRepare na tela: ele nasce SEM nota. Sem evidência, a plataforma não avalia.\x1b[0m`);
  await pausa(1500);

  // ── 2. Credencial ───────────────────────────────────────────────────────
  titulo(2, "Credencial — a identidade do agente, não da pessoa");
  const cred = await api<{ plaintext: string }>(`/agents/${agentId}/api-keys`, {
    method: "POST", body: JSON.stringify({ label: "integração-demo" }),
  });
  const mascarada = cred.plaintext.slice(0, 26) + "…";
  console.log(`   ${mascarada}`);
  console.log(`   \x1b[2mExibida uma única vez. O servidor guarda só o SHA-256 —`);
  console.log(`   um dump do banco não permite replay contra o ingest.\x1b[0m`);
  await pausa(1500);

  // ── 3. O que o time do cliente escreve ──────────────────────────────────
  titulo(3, "Integração — o que o time do cliente precisa escrever");
  console.log(`\x1b[2m   TypeScript, com o SDK:\x1b[0m`);
  console.log(`     const muster = createMusterReporter({ baseUrl, agentId, token });`);
  console.log(`     await muster.trackExecution(() => meuAgente.run(tarefa));`);
  console.log(`\x1b[2m\n   Qualquer outra linguagem, REST puro:\x1b[0m`);
  console.log(`     POST ${baseUrl}/api/agents/${agentId}/events`);
  console.log(`     Authorization: Bearer <a credencial acima>`);
  console.log(`     {"kind":"execution","success":true,"durationMs":1180,"costCents":3}`);
  console.log(`\n   \x1b[2mÉ isso. Não há agente para instalar, nem sidecar, nem mudança de infraestrutura.\x1b[0m`);
  await pausa(2500);

  // ── 4. Execuções entrando ao vivo ───────────────────────────────────────
  titulo(4, `Operação — ${execucoes} execuções chegando ao vivo`);
  console.log(`   \x1b[2mOlhe a tela do agente: os números preenchem sozinhos.\x1b[0m\n`);

  let ok = 0;
  const agora = Date.now();
  for (let i = 0; i < execucoes; i += 1) {
    // Degradação proposital na última terça parte: dá o que discutir na tela.
    const fase = i / execucoes;
    const pSucesso = fase < 0.66 ? 0.97 : 0.74;
    const sucesso = Math.random() < pSucesso;
    const duracao = Math.round(900 + Math.random() * (fase < 0.66 ? 700 : 2600));
    if (sucesso) ok += 1;

    await fetch(`${baseUrl}/api/agents/${agentId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cred.plaintext}` },
      body: JSON.stringify({
        kind: sucesso ? "execution" : "error",
        // Espalha no tempo para a janela de 30 dias ter forma, em vez de um pico.
        ts: new Date(agora - (execucoes - i) * 3_600_000).toISOString(),
        success: sucesso,
        durationMs: duracao,
        costCents: Math.max(1, Math.round(2 + Math.random() * 4)),
        tokensIn: Math.round(700 + Math.random() * 1500),
        tokensOut: Math.round(180 + Math.random() * 600),
        metadata: { origem: "demo-integracao" },
      }),
    }).catch(() => undefined);

    const barra = "█".repeat(Math.round(((i + 1) / execucoes) * 24)).padEnd(24, "·");
    process.stdout.write(`\r   ${barra}  ${i + 1}/${execucoes}  ${sucesso ? "✓" : "✗"}   `);
    await pausa(intervalo);
  }
  console.log(`\n   → ${ok}/${execucoes} com sucesso (${Math.round((ok / execucoes) * 100)}%)`);
  await pausa(1200);

  // ── 5. Avaliação ────────────────────────────────────────────────────────
  titulo(5, "Avaliação — o que a plataforma conclui");
  const v = await api<{ verdict: string; healthScore: number; dataSource: string; rationale: string }>(
    `/agents/${agentId}/reevaluate`, { method: "POST", body: "{}" },
  );
  console.log(`   Veredito:  \x1b[1m${v.verdict.toUpperCase()}\x1b[0m   ·   saúde ${v.healthScore}   ·   fonte: ${v.dataSource}`);
  console.log(`   ${v.rationale}`);

  console.log(`\n   \x1b[2mAbra o agente no Muster para ver as cinco camadas, a telemetria`);
  console.log(`   e o plano de ação que acompanha o veredito.\x1b[0m`);
  console.log(`   ${baseUrl.replace("8087", "5173")}/agentes/${agentId}\n`);
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
