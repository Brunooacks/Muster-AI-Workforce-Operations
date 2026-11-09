import { describe, expect, it } from "vitest";
import {
  formatarContagens0022,
  lerContagens0022,
  startupMigrationsEnabled,
} from "./startup-migrations";

describe("startup migrations", () => {
  it("requires an explicit production opt-in", () => {
    expect(startupMigrationsEnabled()).toBe(false);
    expect(startupMigrationsEnabled("false")).toBe(false);
    expect(startupMigrationsEnabled("TRUE")).toBe(true);
  });
});

describe("contagens da 0022", () => {
  it("antes da 0022 não consulta projects e marca projetos/ambientes como ausentes", async () => {
    const consultas: string[] = [];
    const contagens = await lerContagens0022(async (sql) => {
      consultas.push(sql);
      return { rows: [{ orgs: 3, agentes: 7, chaves: 5, tem_projetos: false }] };
    });
    expect(consultas).toHaveLength(1);
    expect(contagens).toEqual({ orgs: 3, projetos: null, ambientes: null, agentes: 7, chaves: 5 });
    expect(formatarContagens0022(contagens)).toBe(
      "0022: orgs=3 projetos=- ambientes=- agentes=7 chaves=5",
    );
  });

  it("depois da 0022 inclui projetos e ambientes no formato do log", async () => {
    const respostas = [
      { rows: [{ orgs: 3, agentes: 7, chaves: 5, tem_projetos: true }] },
      { rows: [{ projetos: 3, ambientes: 6 }] },
    ];
    const contagens = await lerContagens0022(async () => respostas.shift()!);
    expect(formatarContagens0022(contagens)).toBe(
      "0022: orgs=3 projetos=3 ambientes=6 agentes=7 chaves=5",
    );
  });
});
