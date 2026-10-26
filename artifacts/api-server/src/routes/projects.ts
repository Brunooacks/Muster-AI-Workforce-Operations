import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, environments, projects } from "@workspace/db";
import { CreateProjectBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireOrgAdmin } from "../middlewares/orgRole";
import { ofOrg } from "../lib/tenant-scope";
import { slugify } from "../lib/admission";

/**
 * Projetos da conta (E1). Toda conta já tem o projeto "Padrão" (criado no
 * banco junto com a organização) e todo projeto nasce com `sandbox` e `prod`
 * — também pelo banco, para não depender de a rota lembrar.
 *
 * Diferente da área, o projeto **é** fronteira para quem entra por chave de
 * agente: a chave só alcança o próprio projeto. Para sessão humana a conta
 * segue sendo o limite (org-wide).
 */

const router: IRouter = Router();

type ProjectRow = typeof projects.$inferSelect;
type EnvironmentRow = typeof environments.$inferSelect;

function toProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
  };
}

function toEnvironment(row: EnvironmentRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
  };
}

async function environmentsOf(orgId: string, projectId: string) {
  return db
    .select()
    .from(environments)
    .where(and(ofOrg(environments, orgId), eq(environments.projectId, projectId)))
    .orderBy(asc(environments.kind));
}

router.get("/projects", requireAuth, requireOrg, async (req, res) => {
  const rows = await db
    .select()
    .from(projects)
    .where(ofOrg(projects, req.orgId!))
    .orderBy(asc(projects.createdAt), asc(projects.slug));
  res.json(rows.map(toProject));
});

router.post("/projects", requireAuth, requireOrg, requireOrgAdmin, async (req, res) => {
  const orgId = req.orgId!;
  const parsed = CreateProjectBody.safeParse(req.body ?? {});
  const name = parsed.success ? parsed.data.name.trim() : "";
  if (!parsed.success || !name) {
    res.status(400).json({ error: "Informe o nome do projeto (até 120 caracteres)." });
    return;
  }
  const slug = parsed.data.slug ?? slugify(name);
  if (!slug) {
    res.status(400).json({ error: "Não foi possível derivar um slug do nome; informe slug." });
    return;
  }

  const [row] = await db
    .insert(projects)
    .values({ orgId, name, slug, isDefault: false })
    .onConflictDoNothing({ target: [projects.orgId, projects.slug] })
    .returning();
  if (!row) {
    res.status(409).json({ error: `Já existe um projeto "${slug}" nesta conta.` });
    return;
  }

  res.status(201).json({
    project: toProject(row),
    environments: (await environmentsOf(orgId, row.id)).map(toEnvironment),
  });
});

router.get("/projects/:projectId/environments", requireAuth, requireOrg, async (req, res) => {
  const orgId = req.orgId!;
  const projectId = req.params.projectId as string;
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(ofOrg(projects, orgId), eq(projects.id, projectId)))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado." });
    return;
  }
  res.json((await environmentsOf(orgId, projectId)).map(toEnvironment));
});

export default router;
