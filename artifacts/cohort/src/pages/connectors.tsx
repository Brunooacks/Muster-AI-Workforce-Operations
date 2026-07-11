import { AppLayout } from "@/components/layout";
import {
  useListConnectors,
  useConnectPlatform,
  useDiscoverAgents,
  useImportDiscoveredAgents,
  useRegisterConnector,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Search, Check, Download, Plug, Plus } from "lucide-react";
import { ErrorState } from "@/components/query-state";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getListConnectorsQueryKey } from "@workspace/api-client-react";
import { PageHeading, Pill, Eyebrow } from "@/components/cohort";

// Platforms with a REAL connector implementation; the rest of the list still
// comes from the demo catalog until their connectors land (R3 incremental).
const REAL_PLATFORMS = [{ key: "github", label: "GitHub" }];

export default function ConnectorsPage() {
  const { data: connectors, isLoading, isError, refetch } = useListConnectors();
  const { toast } = useToast();

  const connectPlatform = useConnectPlatform();
  const discoverAgents = useDiscoverAgents();
  const importAgents = useImportDiscoveredAgents();
  const registerConnector = useRegisterConnector();

  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({ platform: "github", name: "", token: "" });

  const handleRegister = () => {
    if (!regForm.name.trim()) return;
    registerConnector.mutate(
      {
        data: {
          platform: regForm.platform,
          name: regForm.name.trim(),
          token: regForm.token.trim() || null,
        },
      },
      {
        onSuccess: (r) => {
          toast({
            title: r.test.ok ? "Conector conectado" : "Conector cadastrado — credencial pendente",
            description: r.test.message,
            variant: r.test.ok ? undefined : "destructive",
          });
          setRegisterOpen(false);
          setRegForm({ platform: "github", name: "", token: "" });
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
        onError: () =>
          toast({ title: "Erro ao cadastrar conector", variant: "destructive" }),
      },
    );
  };

  const handleConnect = (platform: string) => {
    connectPlatform.mutate(
      { data: { platform } },
      {
        onSuccess: () => {
          toast({ title: "Conector vinculado", description: `Conexão com ${platform} estabelecida.` });
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
          setDiscoveryResult(result);
          setDiscoveringId(null);
          toast({ title: "Discovery concluído", description: `${result.agentsFound} agentes encontrados.` });
        },
        onError: () => {
          setDiscoveringId(null);
          toast({ title: "Erro", description: "Falha ao realizar discovery.", variant: "destructive" });
        },
      },
    );
  };

  const handleImport = (externalIds: string[]) => {
    if (!discoveryResult) return;
    importAgents.mutate(
      { connectorId: discoveryResult.connectorId, data: { externalIds } },
      {
        onSuccess: () => {
          toast({ title: "Importação concluída", description: "Agentes admitidos na frota." });
          setDiscoveryResult(null);
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
      },
    );
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Conta" }, { label: "Conectores" }]}>
      <div className="max-w-4xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Conta · Integrações"
          title="Conectores"
          subtitle="Conecte plataformas para descobrir agentes e importar suas métricas propostas automaticamente."
          action={
            <Button onClick={() => setRegisterOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar conector
            </Button>
          }
        />

        {discoveryResult && (
          <Card className="overflow-hidden border-primary/30">
            <div className="border-b border-card-border bg-primary/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-serif text-lg font-medium">
                  Discovery · {discoveryResult.platform}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{discoveryResult.coverageNote}</p>
            </div>
            <div className="divide-y divide-card-border">
              {discoveryResult.agents.map((agent: any) => (
                <div
                  key={agent.externalId}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      <Pill tone="muted">{agent.role}</Pill>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>{agent.proposedMetrics.length} métricas mapeadas</span>
                      <span>· Confiança {agent.confidence}%</span>
                    </div>
                  </div>
                  {agent.alreadyImported ? (
                    <Pill tone="sage">Já na frota</Pill>
                  ) : (
                    <Button size="sm" onClick={() => handleImport([agent.externalId])}>
                      <Download className="mr-1 h-4 w-4" />
                      Importar &amp; admitir
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-card-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setDiscoveryResult(null)}>
                Fechar
              </Button>
            </div>
          </Card>
        )}

        {isError ? (
          <ErrorState title="Não foi possível carregar os conectores" onRetry={() => refetch()} />
        ) : (
          <Card className="overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <Eyebrow>Integrações disponíveis</Eyebrow>
            </div>
            {isLoading ? (
              <div className="divide-y divide-card-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="h-10 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : connectors && connectors.length > 0 ? (
              <div className="divide-y divide-card-border">
                {connectors.map((connector) => {
                  const connected = connector.status === "connected";
                  return (
                    <div
                      key={connector.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary/60 text-muted-foreground">
                          <Plug className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{connector.name}</span>
                            <Pill tone={connected ? "sage" : "muted"}>
                              {connected ? "Conectado" : "Disponível"}
                            </Pill>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {connected
                              ? `${connector.agentsDiscovered} agentes descobertos · último sync ${
                                  connector.lastSyncAt
                                    ? new Date(connector.lastSyncAt).toLocaleDateString("pt-BR")
                                    : "nunca"
                                }`
                              : connector.category}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {connected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiscover(connector.id)}
                            disabled={discoveringId === connector.id}
                          >
                            {discoveringId === connector.id ? (
                              "Descobrindo…"
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" /> Rodar discovery
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnect(connector.platform)}
                            disabled={connectPlatform.isPending}
                          >
                            <Link2 className="mr-2 h-4 w-4" /> Conectar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-muted-foreground">
                <Plug className="h-8 w-8 opacity-50" />
                <p className="font-medium text-foreground">Nenhum conector disponível</p>
                <p className="text-sm">Conecte uma plataforma para começar a descobrir agentes.</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Cadastro de conector real (R3) */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar conector</DialogTitle>
            <DialogDescription>
              Conecte uma plataforma real. A credencial é testada na hora e fica armazenada
              apenas no seu banco — nunca é exibida de volta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                value={regForm.platform}
                onValueChange={(v) => setRegForm((p) => ({ ...p, platform: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REAL_PLATFORMS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                AWS Bedrock, Azure AI e Vertex chegam nas próximas iterações do R3.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-name">Nome do conector</Label>
              <Input
                id="reg-name"
                value={regForm.name}
                placeholder="ex.: GitHub — org principal"
                onChange={(e) => setRegForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-token">Token (PAT)</Label>
              <Input
                id="reg-token"
                type="password"
                value={regForm.token}
                placeholder="ghp_… (opcional — vazio usa GITHUB_TOKEN do ambiente)"
                onChange={(e) => setRegForm((p) => ({ ...p, token: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Escopo mínimo: leitura de repositórios. Fine-grained PAT com{" "}
                <code className="font-mono">contents:read</code> é suficiente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegister}
              disabled={!regForm.name.trim() || registerConnector.isPending}
            >
              {registerConnector.isPending ? "Testando conexão…" : "Cadastrar e testar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
