import { describe, expect, it } from "vitest";
import {
  VERDICT_ACTION_STATUSES,
  canCompleteAction,
  isValidActionStatus,
  summarizeActionProgress,
  didInterventionWork,
} from "./verdict-action-policy";

describe("isValidActionStatus", () => {
  it("aceita apenas os estados do ciclo", () => {
    for (const s of VERDICT_ACTION_STATUSES) expect(isValidActionStatus(s)).toBe(true);
    for (const s of ["done", "feito", "", "COMPLETED", undefined]) {
      expect(isValidActionStatus(s as string)).toBe(false);
    }
  });
});

describe("canCompleteAction", () => {
  it("exige evidência para concluir", () => {
    expect(canCompleteAction({ evidenceAtual: "", evidenceNova: "PR #412 mergeado" })).toBe(true);
    expect(canCompleteAction({ evidenceAtual: "registro anterior", evidenceNova: undefined })).toBe(true);
    expect(canCompleteAction({ evidenceAtual: "", evidenceNova: undefined })).toBe(false);
    expect(canCompleteAction({ evidenceAtual: "", evidenceNova: "   " })).toBe(false);
  });
});

describe("summarizeActionProgress", () => {
  it("conta o andamento do plano", () => {
    const r = summarizeActionProgress([
      { status: "completed" }, { status: "completed" },
      { status: "in-progress" }, { status: "blocked" },
      { status: "proposed" }, { status: "cancelled" },
    ]);
    expect(r.total).toBe(6);
    expect(r.concluidas).toBe(2);
    expect(r.emAndamento).toBe(1);
    expect(r.bloqueadas).toBe(1);
    // canceladas saem do denominador: não são dívida em aberto
    expect(r.percentualConcluido).toBe(40);
    expect(r.pendente).toBe(true);
  });

  it("plano vazio não é 'concluído'", () => {
    const r = summarizeActionProgress([]);
    expect(r.total).toBe(0);
    expect(r.percentualConcluido).toBe(0);
    expect(r.pendente).toBe(false);
  });

  it("tudo cancelado não conta como progresso", () => {
    const r = summarizeActionProgress([{ status: "cancelled" }, { status: "cancelled" }]);
    expect(r.percentualConcluido).toBe(0);
    expect(r.pendente).toBe(false);
  });
});

describe("didInterventionWork", () => {
  it("compara a saúde de agora com a do momento em que a ação começou", () => {
    expect(didInterventionWork({ healthScoreAtApproval: 55, healthScoreAtual: 72 }))
      .toMatchObject({ conclusivo: true, melhorou: true, delta: 17 });
    expect(didInterventionWork({ healthScoreAtApproval: 70, healthScoreAtual: 58 }))
      .toMatchObject({ conclusivo: true, melhorou: false, delta: -12 });
  });

  it("variação dentro do ruído não afirma melhora", () => {
    const r = didInterventionWork({ healthScoreAtApproval: 60, healthScoreAtual: 62 });
    expect(r.conclusivo).toBe(false);
    expect(r.delta).toBe(2);
  });

  it("sem baseline não inventa conclusão", () => {
    expect(didInterventionWork({ healthScoreAtApproval: null, healthScoreAtual: 80 }))
      .toMatchObject({ conclusivo: false, melhorou: null });
  });
});
