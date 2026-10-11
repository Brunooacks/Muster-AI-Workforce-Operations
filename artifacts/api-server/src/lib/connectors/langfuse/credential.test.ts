import { describe, expect, it } from "vitest";
import { parseLangfuseCredential } from "./credential";

describe("parseLangfuseCredential", () => {
  it("aceita chaves Langfuse e usa Cloud como base padrão", async () => {
    await expect(
      parseLangfuseCredential(
        JSON.stringify({
          publicKey: "pk-lf-f2-public",
          secretKey: "sk-lf-f2-secret",
        }),
      ),
    ).resolves.toEqual({
      publicKey: "pk-lf-f2-public",
      secretKey: "sk-lf-f2-secret",
      baseUrl: "https://cloud.langfuse.com",
    });
  });

  it("rejeita credencial inválida sem revelar a chave secreta", async () => {
    const secretKey = "sk-lf-f2-nao-vazar";

    await expect(
      parseLangfuseCredential(
        JSON.stringify({ publicKey: "pk-invalida", secretKey }),
      ),
    ).rejects.toThrow("chave pública");

    await parseLangfuseCredential(
      JSON.stringify({ publicKey: "pk-invalida", secretKey }),
    ).catch((error: Error) => {
      expect(error.message).not.toContain(secretKey);
    });
  });

  it("bloqueia hosts privados em instâncias self-hosted", async () => {
    await expect(
      parseLangfuseCredential(
        JSON.stringify({
          publicKey: "pk-lf-f2-public",
          secretKey: "sk-lf-f2-secret",
          baseUrl: "https://127.0.0.1:3000",
        }),
      ),
    ).rejects.toThrow("não é permitido");
  });

  it("bloqueia loopback IPv6 em instâncias self-hosted", async () => {
    await expect(
      parseLangfuseCredential(
        JSON.stringify({
          publicKey: "pk-lf-f2-public",
          secretKey: "sk-lf-f2-secret",
          baseUrl: "https://[::1]:3000",
        }),
      ),
    ).rejects.toThrow("não é permitido");
  });

  it("bloqueia IPv4 loopback mapeado em IPv6", async () => {
    await expect(
      parseLangfuseCredential(
        JSON.stringify({
          publicKey: "pk-lf-f2-public",
          secretKey: "sk-lf-f2-secret",
          baseUrl: "https://[::ffff:127.0.0.1]:3000",
        }),
      ),
    ).rejects.toThrow("não é permitido");
  });

  it("exige baseUrl HTTPS", async () => {
    await expect(
      parseLangfuseCredential(
        JSON.stringify({
          publicKey: "pk-lf-f2-public",
          secretKey: "sk-lf-f2-secret",
          baseUrl: "http://langfuse.example.com",
        }),
      ),
    ).rejects.toThrow("HTTPS");
  });
});
