import { describe, expect, it } from "vitest";
import {
  CONNECTOR_CAPABILITIES,
  type ConnectorCapabilityEntry,
} from "./capabilities";
import type { ConnectorCapabilities } from "./types";

const CAPABILITY_KEYS: Array<keyof ConnectorCapabilities> = [
  "testConnection",
  "discoverAgents",
  "collectTelemetry",
  "collectMetrics",
  "sendFeedback",
  "exportDecisions",
];

const MODOS_VALIDOS = ["live", "contract-ready", "planned"] as const;

function buscar(platform: string): ConnectorCapabilityEntry | undefined {
  return CONNECTOR_CAPABILITIES.find((entry) => entry.platform === platform);
}

describe("CONNECTOR_CAPABILITIES", () => {
  it("mantém platforms únicos e não vazios no catálogo", () => {
    const platforms = CONNECTOR_CAPABILITIES.map((entry) => entry.platform);

    expect(platforms.length).toBeGreaterThan(0);
    expect(platforms.every((p) => p.trim().length > 0)).toBe(true);
    expect(new Set(platforms).size).toBe(platforms.length);
  });

  it("declara exatamente as 6 chaves de ConnectorCapabilities como boolean em todo item", () => {
    for (const entry of CONNECTOR_CAPABILITIES) {
      const keys = Object.keys(entry.capabilities).sort();

      expect(keys, entry.platform).toEqual([...CAPABILITY_KEYS].sort());
      for (const key of CAPABILITY_KEYS) {
        expect(typeof entry.capabilities[key], `${entry.platform}.${key}`).toBe(
          "boolean",
        );
      }
    }
  });

  it("restringe mode a live, contract-ready ou planned", () => {
    for (const entry of CONNECTOR_CAPABILITIES) {
      expect(
        MODOS_VALIDOS,
        `${entry.platform} => ${String(entry.mode)}`,
      ).toContain(entry.mode);
    }
  });

  it("exige ao menos uma capability ativa para itens live", () => {
    const live = CONNECTOR_CAPABILITIES.filter(
      (entry) => entry.mode === "live",
    );

    expect(live.length).toBeGreaterThan(0);
    for (const entry of live) {
      const ativas = CAPABILITY_KEYS.filter((key) => entry.capabilities[key]);

      expect(
        ativas.length,
        `${entry.platform} sem capability ativa`,
      ).toBeGreaterThan(0);
    }
  });

  it("não declara capability ativa para itens planned", () => {
    const planned = CONNECTOR_CAPABILITIES.filter(
      (entry) => entry.mode === "planned",
    );

    expect(planned.length).toBeGreaterThan(0);
    for (const entry of planned) {
      const ativas = CAPABILITY_KEYS.filter((key) => entry.capabilities[key]);

      expect(
        ativas,
        `${entry.platform} não deveria ter capability ativa`,
      ).toEqual([]);
    }
  });

  it("mantém label, note e ao menos um transport preenchidos", () => {
    for (const entry of CONNECTOR_CAPABILITIES) {
      expect(entry.label.trim(), entry.platform).not.toBe("");
      expect(entry.note.trim(), entry.platform).not.toBe("");
      expect(entry.transport.length, entry.platform).toBeGreaterThanOrEqual(1);
      expect(
        entry.transport.every((t) => t.trim().length > 0),
        entry.platform,
      ).toBe(true);
    }
  });

  it("marca github como live com testConnection e discoverAgents ativas", () => {
    const github = buscar("github");

    expect(github).toBeDefined();
    expect(github?.mode).toBe("live");
    expect(github?.capabilities.testConnection).toBe(true);
    expect(github?.capabilities.discoverAgents).toBe(true);
  });

  it("marca webhook como live com collectTelemetry e collectMetrics ativas", () => {
    const webhook = buscar("webhook");

    expect(webhook).toBeDefined();
    expect(webhook?.mode).toBe("live");
    expect(webhook?.capabilities.collectTelemetry).toBe(true);
    expect(webhook?.capabilities.collectMetrics).toBe(true);
  });

  it("resolve plataforma conhecida e devolve undefined para plataforma desconhecida", () => {
    expect(buscar("kubernetes-otel")?.label).toBe(
      "Kubernetes / Runtime próprio",
    );
    expect(buscar("plataforma-que-nao-existe")).toBeUndefined();
  });
});
