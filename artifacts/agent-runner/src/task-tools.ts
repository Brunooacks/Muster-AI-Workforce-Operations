import { tool } from "langchain";
import { z } from "zod";
import { taskKeys, type ExecutionResult, type TaskExecutor, type TaskKey } from "./execution";

export interface WorkNote {
  action: string;
  rationale: string;
  createdAt: string;
}

export function createTaskTools(
  notes: WorkNote[],
  executor?: TaskExecutor,
  executionResults: ExecutionResult[] = [],
) {
  const readTask = tool(
    async ({ task }) =>
      JSON.stringify({
        task,
        context: "Tarefa operacional de demonstração do Muster.",
        constraints: [
          "Não executar ações irreversíveis.",
          "Sinalizar dependências ou incertezas.",
          "Produzir uma próxima ação verificável.",
        ],
      }),
    {
      name: "read_task",
      description: "Lê o contexto e as restrições de uma tarefa operacional.",
      schema: z.object({ task: z.string().min(1).describe("Descrição da tarefa") }),
    },
  );

  const recordWorkNote = tool(
    async ({ action, rationale }) => {
      const note = { action, rationale, createdAt: new Date().toISOString() };
      notes.push(note);
      return `Ação registrada no histórico do Muster: ${action}`;
    },
    {
      name: "record_work_note",
      description: "Registra a próxima ação recomendada e sua justificativa.",
      schema: z.object({
        action: z.string().min(1).describe("Próxima ação verificável"),
        rationale: z.string().min(1).describe("Justificativa da ação"),
      }),
    },
  );

  const executeTask = tool(
    async ({ taskKey }) => {
      if (!executor) {
        return JSON.stringify({ ok: false, error: "Executor não configurado para este runner." });
      }
      const result = await executor.execute(taskKey);
      executionResults.push(result);
      notes.push({
        action: `Executar tarefa ${taskKey}`,
        rationale: result.exitCode === 0
          ? `Concluída em ${result.durationMs}ms.`
          : `Falhou com código ${result.exitCode}.`,
        createdAt: new Date().toISOString(),
      });
      return JSON.stringify({ ok: result.exitCode === 0, ...result });
    },
    {
      name: "execute_task",
      description: `Executa uma tarefa segura do catálogo: ${taskKeys().join(", ")}. Não aceita comandos arbitrários.`,
      schema: z.object({
        taskKey: z.enum(taskKeys() as [TaskKey, ...TaskKey[]]).describe("Chave da tarefa permitida"),
      }),
    },
  );

  return [readTask, recordWorkNote, executeTask] as [
    typeof readTask,
    typeof recordWorkNote,
    typeof executeTask,
  ];
}
