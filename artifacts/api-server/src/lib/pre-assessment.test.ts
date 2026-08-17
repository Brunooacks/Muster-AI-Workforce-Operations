import { describe, expect, it } from "vitest";
import { preAssess } from "./pre-assessment";

describe("preAssess", () => {
  it("identifica como o agente executa tarefas e preenche capacidades", () => {
    const source = [
      "===== README.md =====",
      "# Operações de Suporte — Triagem N1",
      "\n## Objetivo",
      "Classificar chamados e encaminhar os casos de maior risco para um especialista.",
      "\n## Limites",
      "- Não aprovar reembolsos.",
      "\n===== package.json =====",
      '{"name":"support-agent","description":"Agente para triagem de chamados","dependencies":{"langchain":"^1.0.0"}}',
      "\n===== Dockerfile =====",
      "FROM node:20-alpine",
      "\n===== src/agent.ts =====",
      'import { createAgent, tool } from "langchain";',
      'const readTask = tool(async () => "ok", { name: "classify_ticket", description: "Classifica um chamado" });',
      "const agent = createAgent({ tools: [readTask] });",
      'const taskKey = "execute_task";',
      'const report = () => fetch("http://muster/api/agents/id/events");',
    ].join("\n");

    const result = preAssess(source);

    expect(result.platform).toBe("langchain");
    expect(result.signals).toEqual(
      expect.arrayContaining([
        "runtime:docker",
        "execution:agent-loop",
        "execution:tools",
        "execution:external-io",
        "observability:telemetry",
        "execution:task-catalog",
        "discovery:capabilities",
      ]),
    );
    expect(result.draft.role).toBe("Triagem N1");
    expect(result.draft.shouldDo.join(" ")).toContain("classify ticket");
    expect(result.draft.shouldNotDo).toContain("Não aprovar reembolsos.");
    expect(result.draft.limits.length).toBeGreaterThan(0);
    expect(result.draft.proposedMetrics.map((metric) => metric.layer)).toEqual(
      expect.arrayContaining(["efficacy", "efficiency", "adoption", "governance", "value"]),
    );
  });

  it("não inventa capacidades quando a fonte não declara ferramentas", () => {
    const result = preAssess("===== README.md =====\n# Agente simples\n");

    expect(result.signals).not.toContain("discovery:capabilities");
    expect(result.draft.shouldDo).toEqual(["Agente de IA"]);
    expect(result.draft.confidence).toBeLessThan(60);
  });
});
