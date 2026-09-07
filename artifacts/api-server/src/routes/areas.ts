import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, agents, areas } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import { ofOrg } from "../lib/tenant-scope";
import { slugify } from "../lib/admission";

/**
 * Áreas — a estrutura interna da organização.
 *
 * A organização isola: dado de uma empresa nunca aparece para outra. A área
 * organiza: dentro da mesma empresa, Atendimento e Financeiro têm donos,
 * orçamentos e critérios de sucesso diferentes, e o gestor de cada um precisa
 * ver a própria frota sem o ruído das demais.
 *
 * A distinção é deliberada e vale repetir: **área não é fronteira de
 * segurança**. Quem enxerga a organização enxerga todas as áreas dela. Fazer da
 * área um limite de visibilidade exigiria escopo por área em cada consulta — e
 * uma promessa de confidencialidade que a implementação atual não cumpre. O que
 * a área entrega hoje é recorte e responsabilidade, não sigilo.
 */

const router: IRouter = Router();

type AreaRow = typeof areas.$inferSelect;

interface ResumoDaArea {
  agentes: number;
  saudeMedia: number | null;
  emRisco: number;
  semEvidencia: number;
}

function toArea(row: AreaRow, resumo: ResumoDaArea) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    leader: row.leader,
    costCenter: row.costCenter,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...resumo,
  };
}

const VAZIO: ResumoDaArea = { agentes: 0, saudeMedia: null, emRisco: 0, semEvidencia: 0 };

/**
 * Números por área, em uma consulta só.
 *
 * `saudeMedia` é nula, e não zero, quando a área não tem agente algum — zero
 * seria lido como "frota péssima" quando na verdade não há o que avaliar. É a
 * mesma regra que a plataforma aplica a agente sem evidência.
 */
async function resumosPorArea(orgId: string): Promise<Map<string, ResumoDaArea>> {
  const linhas = await db
    .select({
      areaId: agents.areaId,
      agentes: sql<number>`count(*)::int`,
      saudeMedia: sql<number | null>`avg(${agents.healthScore})`,
      emRisco: sql<number>`count(*) filter (where ${agents.severity} in ('critical','high'))::int`,
      semEvidencia: sql<number>`count(*) filter (where ${agents.healthScore} = 0)::int`,
    })
    .from(agents)
    .where(ofOrg(agents, orgId))
    .groupBy(agents.areaId);

  const mapa = new Map<string, ResumoDaArea>();
  for (const l of linhas) {
    mapa.set(l.areaId ?? "__sem_area__", {
      agentes: l.agentes,
      saudeMedia: l.saudeMedia === null ? null : Math.round(Number(l.saudeMedia)),
      emRisco: l.emRisco,
      semEvidencia: l.semEvidencia,
    });
  }
  return mapa;
}

router.get("/areas", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId!;
  const linhas = await db
    .select()
    .from(areas)
    .where(ofOrg(areas, orgId))
    .orderBy(asc(areas.name));
  const resumos = await resumosPorArea(orgId);

  // A pseudo-área "sem área" só aparece quando existe agente nela. Ela não é uma
  // linha do banco: é a pendência de atribuição, mostrada onde o gestor olha.
  const semArea = resumos.get("__sem_area__");

  res.json({
    areas: linhas.map((l) => toArea(l, resumos.get(l.id) ?? VAZIO)),
    unassigned: semArea ?? null,
  });
});

router.post("/areas", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Informe o nome da área." });
    return;
  }

  const slug = slugify(name);
  const [existente] = await db
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.slug, slug), ofOrg(areas, orgId)));
  if (existente) {
    res.status(409).json({ error: `Já existe uma área "${name}" nesta organização.` });
    return;
  }

  const [linha] = await db
    .insert(areas)
    .values({
      orgId,
      name: name.slice(0, 120),
      slug,
      description: typeof req.body?.description === "string" ? req.body.description.trim() : "",
      leader: typeof req.body?.leader === "string" ? req.body.leader.trim() : "",
      costCenter: typeof req.body?.costCenter === "string" ? req.body.costCenter.trim() : "",
    })
    .returning();

  res.status(201).json(toArea(linha!, VAZIO));
});

router.patch("/areas/:areaId", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const areaId = req.params.areaId as string;

  const [existente] = await db
    .select()
    .from(areas)
    .where(and(eq(areas.id, areaId), ofOrg(areas, orgId)));
  if (!existente) {
    res.status(404).json({ error: "Área não encontrada." });
    return;
  }

  const campo = (k: string, atual: string): string =>
    typeof req.body?.[k] === "string" ? String(req.body[k]).trim() : atual;

  const [linha] = await db
    .update(areas)
    .set({
      name: campo("name", existente.name).slice(0, 120) || existente.name,
      description: campo("description", existente.description),
      leader: campo("leader", existente.leader),
      costCenter: campo("costCenter", existente.costCenter),
      updatedAt: new Date(),
    })
    .where(and(eq(areas.id, areaId), ofOrg(areas, orgId)))
    .returning();

  const resumos = await resumosPorArea(orgId);
  res.json(toArea(linha!, resumos.get(areaId) ?? VAZIO));
});

router.delete("/areas/:areaId", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const areaId = req.params.areaId as string;

  // Os agentes NÃO são apagados junto: o `on delete set null` do schema devolve
  // cada um para "sem área". Perder o recorte organizacional não pode significar
  // perder o agente — e um agente órfão fica visível como pendência, enquanto um
  // agente apagado some sem deixar rastro.
  const apagadas = await db
    .delete(areas)
    .where(and(eq(areas.id, areaId), ofOrg(areas, orgId)))
    .returning({ id: areas.id });

  if (apagadas.length === 0) {
    res.status(404).json({ error: "Área não encontrada." });
    return;
  }
  res.status(204).end();
});

/** Atribui (ou remove) a área de um agente. */
router.patch("/agents/:agentId/area", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const agentId = req.params.agentId as string;
  const areaId: string | null =
    typeof req.body?.areaId === "string" && req.body.areaId ? req.body.areaId : null;

  // A área precisa ser da MESMA organização. Sem esta checagem, um id de área
  // alheia seria aceito e o agente passaria a contar no painel de outra empresa.
  if (areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, areaId), ofOrg(areas, orgId)));
    if (!area) {
      res.status(400).json({ error: "Área não encontrada nesta organização." });
      return;
    }
  }

  const [linha] = await db
    .update(agents)
    .set({ areaId })
    .where(and(eq(agents.id, agentId), ofOrg(agents, orgId)))
    .returning({ id: agents.id, areaId: agents.areaId });

  if (!linha) {
    res.status(404).json({ error: "Agente não encontrado." });
    return;
  }
  res.json(linha);
});

export default router;
