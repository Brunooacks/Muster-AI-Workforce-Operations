/**
 * Simulador de FLUXO com sub-agentes — cria um propósito, um time, N sub-agentes
 * (cada um com o seu modelo de LLM), a jornada que os encadeia, os handoffs
 * entre etapas, e então executa runs reportando eventos por etapa.
 *
 * O que a demo responde:
 *   · Controle    — quem faz o quê, em que ordem, sob qual modo de decisão.
 *   · Consumo     — quanto cada sub-agente e cada modelo custa no fluxo.
 *   · Resultado   — conclusão ponta a ponta, gargalo e qual elo derruba o todo.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run demo:fluxo
 *   pnpm --filter @workspace/scripts run demo:fluxo -- --execucoes=100
 *   pnpm --filter @workspace/scripts run demo:fluxo -- --arquivo=/caminho/meu-fluxo.json
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENARIO_DIR = resolve(HERE, "..", "scenarios");

type Comportamento = "saudavel" | "degradando" | "erratico";

interface SubAgente {
  nome: string;
  papel: string;
  plataforma: string;
  modelo: string;
  custoPorMilTokensCentavos: number;
  tokensMedios: number;
  duracaoEsperadaMs: number;
  modoDecisao: "autonomous" | "human-approval" | "committee";
  comportamento: Comportamento;
  responsabilidade: string;
  guardrails?: string[];
  contextoHandoff?: string[];
}

interface FluxoCenario {
  fluxo: string;
  descricao?: string;
  propositoChave: string;
  propositoNome: string;
  dominio: string;
  resultadoEsperado: string;
  time: string;
  slaMinutos: number;
  responsavel: string;
  criterioEntrada: string;
  criterioSucesso: string;
  execucoes?: number;
  subAgentes: SubAgente[];
}

/** Taxa de sucesso por comportamento, do início ao fim da janela observada. */
const CURVAS: Record<Comportamento, { inicio: number; fim: number }> = {
  saudavel: { inicio: 0.985, fim: 0.99 },
  degradando: { inicio: 0.96, fim: 0.74 },
  erratico: { inicio: 0.72, fim: 0.6 },
};

function arg(nome: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (hit) return hit.slice(nome.length + 3);
  return process.argv.includes(`--${nome}`) ? "true" : undefined;
}

const baseUrl = (arg("base-url") ?? process.env.MUSTER_BASE_URL ?? "http://localhost:8087").replace(/\/+$/, "");

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260819);
const faixa = (lo: number, hi: number) => lo + rng() * (hi - lo);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${texto.slice(0, 400)}`);
  return (texto ? JSON.parse(texto) : undefined) as T;
}
const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function carregar(): FluxoCenario {
  const arquivo = arg("arquivo");
  const nome = arg("cenario") ?? "fluxo-multiagente";
  const caminho = arquivo ? resolve(arquivo) : resolve(SCENARIO_DIR, `${nome}.json`);
  if (!existsSync(caminho)) throw new Error(`Cenário de fluxo não encontrado: ${caminho}`);
  return JSON.parse(readFileSync(caminho, "utf8")) as FluxoCenario;
}

interface Ident { id: string }
interface Passo { id: string; stepKey: string; name: string }

function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function ms(v: number): string {
  return v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s` : `${Math.round(v)}ms`;
}
function tabela(linhas: Array<Record<string, string>>): string {
  if (linhas.length === 0) return "(vazio)";
  const cols = Object.keys(linhas[0]!);
  const w = cols.map((c) => Math.max(c.length, ...linhas.map((l) => String(l[c] ?? "").length)));
  const ln = (v: string[]) => v.map((x, i) => x.padEnd(w[i]!)).join("  ");
  return [ln(cols), ln(w.map((n) => "─".repeat(n))), ...linhas.map((l) => ln(cols.map((c) => String(l[c] ?? ""))))].join("\n");
}

async function main(): Promise<void> {
  const c = carregar();
  const execucoes = Number(arg("execucoes") ?? c.execucoes ?? 60);

  console.log(`\n▸ Fluxo: ${c.fluxo}`);
  if (c.descricao) console.log(`  ${c.descricao}`);
  console.log(`  API: ${baseUrl} · sub-agentes: ${c.subAgentes.length} · execuções: ${execucoes}\n`);

  // 1. Propósito — a razão de negócio que justifica o fluxo existir.
  const propositos = await api<Array<Ident & { key: string }>>("/purposes");
  const proposito =
    propositos.find((p) => p.key === c.propositoChave) ??
    (await post<Ident>("/purposes", {
      key: c.propositoChave, name: c.propositoNome, domain: c.dominio,
      outcome: c.resultadoEsperado, riskTier: "medium",
      description: c.descricao ?? c.resultadoEsperado,
    }));

  // 2. Time misto que responde pelo fluxo.
  const timeSlug = slugify(c.time);
  const times = await api<Array<Ident & { slug: string }>>("/teams");
  const time =
    times.find((t) => t.slug === timeSlug) ??
    (await post<Ident>("/teams", {
      name: c.time, slug: timeSlug,
      description: `Time responsável pelo fluxo "${c.fluxo}".`,
      purposeId: proposito.id,
    }));

  // 3. Sub-agentes — cada um com o seu modelo declarado na carteira.
  console.log("Admitindo sub-agentes:");
  const agentes: Array<Ident & { sub: SubAgente }> = [];
  const frota = await api<Array<Ident & { name: string }>>("/agents");
  for (const [i, sub] of c.subAgentes.entries()) {
    const nomeCompleto = `[fluxo] ${sub.nome}`;
    const existente = frota.find((a) => a.name === nomeCompleto);
    const agente: Ident = existente ?? (await post<{ agent: Ident }>("/agents", {
      name: nomeCompleto, role: sub.papel, platform: sub.plataforma, version: "1.0.0",
      bio: `${sub.papel}. Modelo: ${sub.modelo}. Etapa ${i + 1} do fluxo "${c.fluxo}".`,
      tagline: `${sub.papel} · ${sub.modelo}`,
      shouldDo: [sub.responsabilidade],
      shouldNotDo: sub.guardrails ?? ["Executar ação irreversível sem aprovação"],
      autonomyLevel: sub.modoDecisao === "autonomous" ? "autonomous" : "escalates",
      autonomyNotes: `Modo de decisão da etapa: ${sub.modoDecisao}.`,
      limits: sub.guardrails ?? [],
      businessOwner: c.responsavel, technicalOwner: "Engenharia de Agentes",
      governanceSponsor: "Comitê de Governança",
      baseline: `${execucoes} execuções observadas no fluxo.`,
      targetPayback: "A definir",
      businessCaseDescription: `Sub-agente da etapa ${i + 1} de "${c.fluxo}".`,
      proposedMetrics: [
        { layer: "efficacy", label: "Sucesso da etapa", unit: "%", target: "≥ 95%", value: 95 },
        { layer: "efficiency", label: "Custo por execução", unit: "R$", target: "R$ 0,01–0,30",
          value: (sub.custoPorMilTokensCentavos * sub.tokensMedios) / 1000 / 100 },
      ],
    }).then((d) => d.agent));
    agentes.push({ id: agente.id, sub });
    console.log(`  ${i + 1}. ${sub.nome.padEnd(26)} ${sub.modelo.padEnd(16)} ${sub.modoDecisao}`);

    await post(`/teams/${time.id}/agents`, {
      agentId: agente.id,
      assignmentRole: i === 0 ? "primary" : sub.modoDecisao === "human-approval" ? "reviewer" : "supporting",
      responsibility: sub.responsabilidade,
    }).catch(() => undefined); // já atribuído
  }

  // 4. Jornada + etapas na ordem + handoffs entre elas.
  const jornadaSlug = slugify(c.fluxo);
  const jornadas = await api<Array<Ident & { slug: string }>>("/journeys");
  const jornada =
    jornadas.find((j) => j.slug === jornadaSlug) ??
    (await post<Ident>("/journeys", {
      teamId: time.id, name: c.fluxo, slug: jornadaSlug,
      description: c.descricao ?? "", entryCriterion: c.criterioEntrada,
      successCriterion: c.criterioSucesso, status: "active",
      slaMinutes: c.slaMinutos, owner: c.responsavel,
    }));

  let detalhe = await api<{ steps: Passo[]; handoffs: Array<{ fromStepId: string; toStepId: string }> }>(`/journeys/${jornada.id}`);
  for (const [i, { id: agentId, sub }] of agentes.entries()) {
    const stepKey = slugify(sub.nome);
    if (detalhe.steps.some((s) => s.stepKey === stepKey)) continue;
    await post(`/journeys/${jornada.id}/steps`, {
      stepKey, name: sub.nome, agentId, responsibility: sub.responsabilidade,
      decisionMode: sub.modoDecisao, expectedDurationMs: sub.duracaoEsperadaMs,
      guardrails: sub.guardrails ?? [], sequence: i + 1, stepType: "agent", required: true,
    });
    detalhe = await api(`/journeys/${jornada.id}`);
  }
  const passos = [...detalhe.steps].sort(
    (a, b) => agentes.findIndex((x) => slugify(x.sub.nome) === a.stepKey) -
              agentes.findIndex((x) => slugify(x.sub.nome) === b.stepKey),
  );

  for (let i = 0; i < passos.length - 1; i += 1) {
    const de = passos[i]!, para = passos[i + 1]!;
    if (detalhe.handoffs.some((h) => h.fromStepId === de.id && h.toStepId === para.id)) continue;
    await post(`/journeys/${jornada.id}/handoffs`, {
      fromStepId: de.id, toStepId: para.id, protocol: "a2a-context-envelope-v1",
      condition: `Contexto de "${de.name}" completo`,
      requiredContext: agentes[i]!.sub.contextoHandoff ?? ["run_id"],
    });
  }
  console.log(`\nJornada montada: ${passos.length} etapas, ${passos.length - 1} handoffs, SLA ${c.slaMinutos} min.`);

  // 5. Executar o fluxo: cada run percorre as etapas, cada etapa reporta o seu
  //    evento com duração e custo derivados do modelo daquele sub-agente.
  console.log(`\nExecutando ${execucoes} runs…`);
  const consumo = new Map<string, { custo: number; duracao: number; ok: number; total: number }>();
  let concluidos = 0;
  const agora = Date.now();

  for (let r = 0; r < execucoes; r += 1) {
    const runId = `run-${r + 1}`;
    const progresso = execucoes <= 1 ? 1 : r / (execucoes - 1);
    let instante = agora - (execucoes - r) * 60_000;
    let vivo = true;

    // O monitoramento da jornada calcula conclusão a partir dos eventos
    // terminais do run — sem eles, a API reporta 0% mesmo com etapas completas.
    await post(`/journeys/${jornada.id}/events`, {
      externalEventId: `${jornadaSlug}:${runId}:started`,
      runId, kind: "journey_started", ts: new Date(instante).toISOString(), success: true,
      metadata: { fluxo: c.fluxo },
    }).catch(() => undefined);

    for (const [i, passo] of passos.entries()) {
      if (!vivo) break;
      const sub = agentes[i]!.sub;
      const curva = CURVAS[sub.comportamento];
      const pSucesso = curva.inicio + (curva.fim - curva.inicio) * progresso;
      const sucesso = rng() < pSucesso;
      const duracao = Math.round(sub.duracaoEsperadaMs * faixa(0.75, 1.5));
      const tokens = Math.round(sub.tokensMedios * faixa(0.8, 1.3));
      const custo = Math.max(1, Math.round((tokens / 1000) * sub.custoPorMilTokensCentavos));
      instante += duracao;

      await post(`/journeys/${jornada.id}/events`, {
        externalEventId: `${jornadaSlug}:${runId}:${passo.stepKey}`,
        runId, stepId: passo.id, agentId: agentes[i]!.id,
        kind: sucesso ? "step_completed" : "step_failed",
        ts: new Date(instante).toISOString(),
        durationMs: duracao, costCents: custo, success: sucesso,
        metadata: { modelo: sub.modelo, tokens, etapa: i + 1, comportamento: sub.comportamento },
      }).catch(() => undefined);

      const acc = consumo.get(sub.nome) ?? { custo: 0, duracao: 0, ok: 0, total: 0 };
      acc.custo += custo; acc.duracao += duracao; acc.ok += sucesso ? 1 : 0; acc.total += 1;
      consumo.set(sub.nome, acc);

      if (!sucesso) { vivo = false; break; }

      if (i < passos.length - 1) {
        instante += 400;
        await post(`/journeys/${jornada.id}/events`, {
          externalEventId: `${jornadaSlug}:${runId}:handoff-${i}`,
          runId, fromStepId: passo.id, toStepId: passos[i + 1]!.id,
          kind: "handoff", ts: new Date(instante).toISOString(), success: true,
          metadata: { protocolo: "a2a-context-envelope-v1" },
        }).catch(() => undefined);
      }
    }
    instante += 300;
    await post(`/journeys/${jornada.id}/events`, {
      externalEventId: `${jornadaSlug}:${runId}:${vivo ? "completed" : "failed"}`,
      runId, kind: vivo ? "journey_completed" : "journey_failed",
      ts: new Date(instante).toISOString(), success: vivo,
      metadata: { fluxo: c.fluxo },
    }).catch(() => undefined);

    if (vivo) concluidos += 1;
    if ((r + 1) % 20 === 0) process.stdout.write(`  ${r + 1}/${execucoes}\n`);
  }

  // 6. Leitura do fluxo: controle, consumo e resultado.
  const custoTotal = [...consumo.values()].reduce((s, v) => s + v.custo, 0);
  const linhas = agentes.map(({ sub }, i) => {
    const a = consumo.get(sub.nome)!;
    return {
      "#": String(i + 1),
      "Sub-agente": sub.nome,
      Modelo: sub.modelo,
      Decisão: sub.modoDecisao,
      Execuções: String(a.total),
      Sucesso: `${Math.round((a.ok / Math.max(1, a.total)) * 100)}%`,
      "Tempo médio": ms(a.duracao / Math.max(1, a.total)),
      Custo: brl(a.custo),
      "% custo": `${Math.round((a.custo / Math.max(1, custoTotal)) * 100)}%`,
    };
  });

  console.log(`\n${tabela(linhas)}\n`);

  const gargalo = agentes.reduce((pior, { sub }) => {
    const a = consumo.get(sub.nome)!, b = consumo.get(pior.sub.nome)!;
    return a.duracao / a.total > b.duracao / b.total ? { sub } as typeof pior : pior;
  }, agentes[0]!);
  const maisCaro = agentes.reduce((pior, { sub }) =>
    consumo.get(sub.nome)!.custo > consumo.get(pior.sub.nome)!.custo ? { sub } as typeof pior : pior, agentes[0]!);
  const eloFraco = agentes.reduce((pior, { sub }) => {
    const a = consumo.get(sub.nome)!, b = consumo.get(pior.sub.nome)!;
    return a.ok / a.total < b.ok / b.total ? { sub } as typeof pior : pior;
  }, agentes[0]!);

  console.log("Leitura do fluxo");
  console.log(`  Conclusão ponta a ponta   ${Math.round((concluidos / execucoes) * 100)}%  (${concluidos}/${execucoes} runs)`);
  console.log(`  Custo do fluxo            ${brl(custoTotal)}  ·  ${brl(custoTotal / execucoes)} por run`);
  console.log(`  Gargalo de tempo          ${gargalo.sub.nome} (${gargalo.sub.modelo})`);
  console.log(`  Maior consumo             ${maisCaro.sub.nome} (${maisCaro.sub.modelo}) — ${Math.round((consumo.get(maisCaro.sub.nome)!.custo / custoTotal) * 100)}% do custo`);
  console.log(`  Elo que derruba o todo    ${eloFraco.sub.nome} — ${Math.round((consumo.get(eloFraco.sub.nome)!.ok / consumo.get(eloFraco.sub.nome)!.total) * 100)}% de sucesso`);

  try {
    const mon = await api<Record<string, unknown>>(`/journeys/${jornada.id}/monitoring`);
    const campos = ["completionRate", "activeRuns", "p95DurationMs", "totalCostCents", "bottleneckStepId"];
    const presentes = campos.filter((k) => mon[k] !== undefined);
    if (presentes.length) {
      console.log("\nMonitoramento da jornada (API):");
      for (const k of presentes) console.log(`  ${k}: ${JSON.stringify(mon[k])}`);
    }
  } catch {
    // monitoramento é complementar; a leitura acima já veio dos eventos reportados
  }

  console.log(`\nAbra /jornadas no Muster para ver o fluxo, as etapas e o detector em cima dele.\n`);
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
