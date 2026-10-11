import { describe, expect, it } from "vitest";
import {
  detectRepeatedSteps,
  type RepeatedStepObservation,
} from "./repeated-step-detector";

const observation = (
  overrides: Partial<RepeatedStepObservation> = {},
): RepeatedStepObservation => ({
  stepKey: "classify.ticket.v1",
  inputFingerprint: "input-a",
  outputHash: "output-a",
  path: "model",
  shadow: false,
  costCents: 10,
  currency: "BRL",
  ...overrides,
});

const repeated = (
  count: number,
  overrides: Partial<RepeatedStepObservation> = {},
) =>
  Array.from({ length: count }, (_, index) =>
    observation({
      inputFingerprint: index % 2 === 0 ? "input-a" : "input-b",
      outputHash: index % 2 === 0 ? "output-a" : "output-b",
      ...overrides,
    }),
  );

describe("detectRepeatedSteps", () => {
  it("recomenda certificar como código para um passo repetido, determinístico e caro", () => {
    const result = detectRepeatedSteps({
      observations: [
        ...repeated(200),
        ...repeated(100, { stepKey: "other.step.v1", costCents: 60 }),
      ],
    });

    const candidate = result.find(
      (item) => item.stepKey === "classify.ticket.v1",
    );
    expect(candidate).toMatchObject({
      stepKey: "classify.ticket.v1",
      currency: "BRL",
      sampleSize: 200,
      totalCostCents: 2_000,
      dominantOutputRate: 1,
      costShare: 0.25,
      eligible: true,
      reasons: [],
      recommendation: {
        action: "distill_step",
        label: "Certificar como código",
      },
    });
    expect(candidate).not.toHaveProperty("inputFingerprint");
    expect(candidate).not.toHaveProperty("outputHash");
  });

  it("marca motivos independentes quando a amostra, estabilidade ou custo não atingem o limiar", () => {
    const fewSamples = repeated(199, {
      stepKey: "few.samples.v1",
      costCents: 200,
    });
    fewSamples[0] = { ...fewSamples[0]!, costCents: 400 };
    const unstable = repeated(200).map((item, index) =>
      index < 195 ? item : { ...item, outputHash: "output-divergente" },
    );
    const lowShare = repeated(200, { stepKey: "low.share.v1", costCents: 199 });
    const result = detectRepeatedSteps({
      observations: [
        ...fewSamples,
        ...unstable.map((item) => ({
          ...item,
          stepKey: "unstable.step.v1",
          costCents: 200,
        })),
        ...lowShare,
        ...repeated(100, { stepKey: "expensive.other.v1", costCents: 802 }),
      ],
    });

    expect(
      result.find((item) => item.stepKey === "few.samples.v1"),
    ).toMatchObject({
      eligible: false,
      reasons: ["minimum_sample"],
      recommendation: null,
    });
    expect(
      result.find((item) => item.stepKey === "unstable.step.v1"),
    ).toMatchObject({
      eligible: false,
      dominantOutputRate: 0.975,
      reasons: ["dominant_output_rate"],
      recommendation: null,
    });
    expect(
      result.find((item) => item.stepKey === "low.share.v1"),
    ).toMatchObject({
      eligible: false,
      costShare: 0.199,
      reasons: ["cost_share"],
      recommendation: null,
    });
  });

  it("segmenta custo por moeda e exclui passos humanos e shadow", () => {
    const result = detectRepeatedSteps({
      observations: [
        ...repeated(200),
        ...repeated(100, { stepKey: "other.step.v1", costCents: 60 }),
        ...repeated(200, { currency: "USD", costCents: 1_000 }),
        ...repeated(300, {
          stepKey: "human.step.v1",
          path: "human",
          costCents: 9_999,
        }),
        ...repeated(300, {
          stepKey: "shadow.step.v1",
          shadow: true,
          costCents: 9_999,
        }),
      ],
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stepKey: "classify.ticket.v1",
          currency: "BRL",
          costShare: 0.25,
          eligible: true,
        }),
        expect.objectContaining({
          stepKey: "classify.ticket.v1",
          currency: "USD",
          costShare: 1,
          eligible: true,
        }),
      ]),
    );
    expect(result.map((item) => item.stepKey)).not.toContain("human.step.v1");
    expect(result.map((item) => item.stepKey)).not.toContain("shadow.step.v1");
  });

  it("não recomenda certificação quando a moeda não tem custo observado", () => {
    const result = detectRepeatedSteps({
      observations: repeated(200, { costCents: 0 }),
    });

    expect(result).toEqual([expect.objectContaining({
      stepKey: "classify.ticket.v1",
      totalCostCents: 0,
      costShare: 0,
      eligible: false,
      reasons: ["cost_share"],
      recommendation: null,
    })]);
  });
});
