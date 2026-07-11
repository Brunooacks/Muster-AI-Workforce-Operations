import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Compass, Plug, Check, Link2, Download, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eyebrow, Pill, AgentDisc } from "@/components/cohort";
import {
  useListConnectors,
  useConnectPlatform,
  useDiscoverAgents,
  useImportDiscoveredAgents,
  getListConnectorsQueryKey,
  type DiscoveryResult,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { completeOnboarding } from "@/lib/onboarding";
import { platformLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const STEPS = ["Boas-vindas", "Conectar fonte", "Mapear agentes"];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  const { data: connectors } = useListConnectors();
  const connectPlatform = useConnectPlatform();
  const discoverAgents = useDiscoverAgents();
  const importAgents = useImportDiscoveredAgents();

  const finish = () => {
    completeOnboarding(user?.id);
    setLocation("/comando");
  };

  const handleConnect = (platform: string) => {
    connectPlatform.mutate(
      { data: { platform } },
      {
        onSuccess: () => {
          toast({ title: "Fonte conectada", description: `${platformLabel(platform)} vinculada.` });
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
      },
    );
  };

  const handleDiscover = (connectorId: string) => {
    setDiscoveringId(connectorId);
    discoverAgents.mutate(
      { connectorId },
      {
        onSuccess: (result) => {
          setDiscovery(result);
          setDiscoveringId(null);
          setStep(2);
        },
        onError: () => {
          setDiscoveringId(null);
          toast({ title: "Erro", description: "Falha ao descobrir agentes.", variant: "destructive" });
        },
      },
    );
  };

  const handleImportAll = () => {
    if (!discovery) return;
    const ids = discovery.agents.filter((a) => !a.alreadyImported).map((a) => a.externalId);
    if (ids.length === 0) {
      finish();
      return;
    }
    importAgents.mutate(
      { connectorId: discovery.connectorId, data: { externalIds: ids } },
      {
        onSuccess: () => {
          toast({ title: "Frota iniciada", description: `${ids.length} agentes admitidos.` });
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
          finish();
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* Stepper */}
        <div className="mb-8 flex items-center justify-between">
          <span className="font-serif text-xl font-medium tracking-tight text-foreground">
            Muster
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Pular configuração
          </button>
        </div>

        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  i < step
                    ? "bg-chart-1 text-white"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 0 — Boas-vindas */}
        {step === 0 && (
          <Card className="p-8 text-center animate-in fade-in duration-300">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Compass className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <Eyebrow>Bem-vindo</Eyebrow>
            <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight text-foreground">
              Vamos montar sua frota
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              O Muster dá identidade, carteira de trabalho e análise de desempenho aos seus agentes
              de IA — em três passos rápidos você terá sua primeira frota mapeada.
            </p>
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
              {[
                { icon: Plug, t: "Conecte uma fonte", d: "Plug-and-play" },
                { icon: Sparkles, t: "Descubra agentes", d: "Mapeamento automático" },
                { icon: Check, t: "Admita na frota", d: "Com 1 clique" },
              ].map((f) => (
                <div key={f.t} className="rounded-xl border border-card-border bg-secondary/30 p-4">
                  <f.icon className="mb-2 h-5 w-5 text-chart-2" strokeWidth={1.75} />
                  <div className="text-sm font-medium text-foreground">{f.t}</div>
                  <div className="text-xs text-muted-foreground">{f.d}</div>
                </div>
              ))}
            </div>
            <Button className="mt-8 w-full sm:w-auto" onClick={() => setStep(1)}>
              Começar <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Card>
        )}

        {/* Step 1 — Conectar fonte */}
        {step === 1 && (
          <Card className="overflow-hidden animate-in fade-in duration-300">
            <div className="border-b border-card-border px-6 py-5">
              <Eyebrow>Passo 2</Eyebrow>
              <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight text-foreground">
                Conecte uma fonte
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Vincule uma plataforma e rode o discovery para encontrar seus agentes.
              </p>
            </div>
            <div className="divide-y divide-card-border">
              {(connectors ?? []).map((connector) => {
                const connected = connector.status === "connected";
                return (
                  <div
                    key={connector.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary/60 text-muted-foreground">
                        <Plug className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {connector.name}
                          </span>
                          <Pill tone={connected ? "sage" : "muted"}>
                            {connected ? "Conectado" : "Disponível"}
                          </Pill>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {connector.category}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {connected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDiscover(connector.id)}
                          disabled={discoveringId === connector.id}
                        >
                          {discoveringId === connector.id ? (
                            "Descobrindo…"
                          ) : (
                            <>
                              <Sparkles className="mr-1.5 h-4 w-4" /> Rodar discovery
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnect(connector.platform)}
                          disabled={connectPlatform.isPending}
                        >
                          <Link2 className="mr-1.5 h-4 w-4" /> Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-card-border px-6 py-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button variant="ghost" size="sm" onClick={finish}>
                Fazer isso depois
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2 — Mapear agentes */}
        {step === 2 && (
          <Card className="overflow-hidden animate-in fade-in duration-300">
            <div className="border-b border-card-border px-6 py-5">
              <Eyebrow>Passo 3</Eyebrow>
              <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight text-foreground">
                Confirme os agentes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {discovery?.coverageNote ??
                  "Revise os agentes descobertos e admita-os na sua frota."}
              </p>
            </div>
            <div className="divide-y divide-card-border">
              {(discovery?.agents ?? []).map((agent) => (
                <div key={agent.externalId} className="flex items-center justify-between gap-3 px-6 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <AgentDisc name={agent.name} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{agent.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {agent.role} · {agent.proposedMetrics.length} métricas · {agent.confidence}%
                      </div>
                    </div>
                  </div>
                  {agent.alreadyImported ? (
                    <Pill tone="sage">Já na frota</Pill>
                  ) : (
                    <Pill tone="ochre">Novo</Pill>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-card-border px-6 py-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={handleImportAll} disabled={importAgents.isPending}>
                <Download className="mr-1.5 h-4 w-4" />
                {importAgents.isPending ? "Admitindo…" : "Admitir e concluir"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
