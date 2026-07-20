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
import { useLang, localeOf, type Lang } from "@/lib/i18n";

// Platforms with a REAL connector implementation; the rest of the list still
// comes from the demo catalog until their connectors land (R3 incremental).
const REAL_PLATFORMS = [{ key: "github", label: "GitHub" }];

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  bcAccount: "Conta",
  bcConnectors: "Conectores",
  eyebrow: "Conta · Integrações",
  title: "Conectores",
  subtitle:
    "Conecte plataformas para descobrir agentes e importar suas métricas propostas automaticamente.",
  registerBtn: "Cadastrar conector",
  toastRegOk: "Conector conectado",
  toastRegPending: "Conector cadastrado — credencial pendente",
  toastRegErr: "Erro ao cadastrar conector",
  toastLinked: "Conector vinculado",
  toastLinkedDesc: (platform: string) => `Conexão com ${platform} estabelecida.`,
  toastDiscoveryDone: "Discovery concluído",
  toastDiscoveryDesc: (n: number) => `${n} agentes encontrados.`,
  toastErr: "Erro",
  toastDiscoveryFail: "Falha ao realizar discovery.",
  toastImportDone: "Importação concluída",
  toastImportDesc: "Agentes admitidos na frota.",
  discoveryTitle: "Discovery",
  metricsMapped: (n: number) => `${n} métricas mapeadas`,
  confidence: (c: number) => `· Confiança ${c}%`,
  alreadyInFleet: "Já na frota",
  importAdmit: "Importar & admitir",
  close: "Fechar",
  errLoad: "Não foi possível carregar os conectores",
  availableIntegrations: "Integrações disponíveis",
  connected: "Conectado",
  available: "Disponível",
  connectedMeta: (n: number, lastSync: string) =>
    `${n} agentes descobertos · último sync ${lastSync}`,
  never: "nunca",
  discovering: "Descobrindo…",
  runDiscovery: "Rodar discovery",
  connect: "Conectar",
  emptyTitle: "Nenhum conector disponível",
  emptyDesc: "Conecte uma plataforma para começar a descobrir agentes.",
  dialogTitle: "Cadastrar conector",
  dialogDesc:
    "Conecte uma plataforma real. A credencial é testada na hora e fica armazenada apenas no seu banco — nunca é exibida de volta.",
  platformLabel: "Plataforma",
  platformsSoon: "AWS Bedrock, Azure AI e Vertex chegam nas próximas iterações do R3.",
  nameLabel: "Nome do conector",
  namePlaceholder: "ex.: GitHub — org principal",
  tokenLabel: "Token (PAT)",
  tokenPlaceholder: "ghp_… (opcional — vazio usa GITHUB_TOKEN do ambiente)",
  scopePre: "Escopo mínimo: leitura de repositórios. Fine-grained PAT com",
  scopePost: "é suficiente.",
  cancel: "Cancelar",
  testing: "Testando conexão…",
  registerTest: "Cadastrar e testar",
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    bcAccount: "Account",
    bcConnectors: "Connectors",
    eyebrow: "Account · Integrations",
    title: "Connectors",
    subtitle:
      "Connect platforms to discover agents and import their proposed metrics automatically.",
    registerBtn: "Register connector",
    toastRegOk: "Connector connected",
    toastRegPending: "Connector registered — credential pending",
    toastRegErr: "Error registering connector",
    toastLinked: "Connector linked",
    toastLinkedDesc: (platform: string) => `Connection with ${platform} established.`,
    toastDiscoveryDone: "Discovery complete",
    toastDiscoveryDesc: (n: number) => `${n} agents found.`,
    toastErr: "Error",
    toastDiscoveryFail: "Failed to run discovery.",
    toastImportDone: "Import complete",
    toastImportDesc: "Agents admitted to the fleet.",
    discoveryTitle: "Discovery",
    metricsMapped: (n: number) => `${n} metrics mapped`,
    confidence: (c: number) => `· Confidence ${c}%`,
    alreadyInFleet: "Already in the fleet",
    importAdmit: "Import & admit",
    close: "Close",
    errLoad: "Could not load the connectors",
    availableIntegrations: "Available integrations",
    connected: "Connected",
    available: "Available",
    connectedMeta: (n: number, lastSync: string) =>
      `${n} agents discovered · last sync ${lastSync}`,
    never: "never",
    discovering: "Discovering…",
    runDiscovery: "Run discovery",
    connect: "Connect",
    emptyTitle: "No connectors available",
    emptyDesc: "Connect a platform to start discovering agents.",
    dialogTitle: "Register connector",
    dialogDesc:
      "Connect a real platform. The credential is tested on the spot and stored only in your database — it is never displayed back.",
    platformLabel: "Platform",
    platformsSoon: "AWS Bedrock, Azure AI and Vertex arrive in the next R3 iterations.",
    nameLabel: "Connector name",
    namePlaceholder: "e.g.: GitHub — main org",
    tokenLabel: "Token (PAT)",
    tokenPlaceholder: "ghp_… (optional — empty uses the environment's GITHUB_TOKEN)",
    scopePre: "Minimum scope: repository read. A fine-grained PAT with",
    scopePost: "is enough.",
    cancel: "Cancel",
    testing: "Testing connection…",
    registerTest: "Register and test",
  },
  es: {
    bcAccount: "Cuenta",
    bcConnectors: "Conectores",
    eyebrow: "Cuenta · Integraciones",
    title: "Conectores",
    subtitle:
      "Conecta plataformas para descubrir agentes e importar sus métricas propuestas automáticamente.",
    registerBtn: "Registrar conector",
    toastRegOk: "Conector conectado",
    toastRegPending: "Conector registrado — credencial pendiente",
    toastRegErr: "Error al registrar el conector",
    toastLinked: "Conector vinculado",
    toastLinkedDesc: (platform: string) => `Conexión con ${platform} establecida.`,
    toastDiscoveryDone: "Discovery completado",
    toastDiscoveryDesc: (n: number) => `${n} agentes encontrados.`,
    toastErr: "Error",
    toastDiscoveryFail: "Fallo al realizar el discovery.",
    toastImportDone: "Importación completada",
    toastImportDesc: "Agentes admitidos en la flota.",
    discoveryTitle: "Discovery",
    metricsMapped: (n: number) => `${n} métricas mapeadas`,
    confidence: (c: number) => `· Confianza ${c}%`,
    alreadyInFleet: "Ya en la flota",
    importAdmit: "Importar y admitir",
    close: "Cerrar",
    errLoad: "No fue posible cargar los conectores",
    availableIntegrations: "Integraciones disponibles",
    connected: "Conectado",
    available: "Disponible",
    connectedMeta: (n: number, lastSync: string) =>
      `${n} agentes descubiertos · última sincronización ${lastSync}`,
    never: "nunca",
    discovering: "Descubriendo…",
    runDiscovery: "Ejecutar discovery",
    connect: "Conectar",
    emptyTitle: "Ningún conector disponible",
    emptyDesc: "Conecta una plataforma para comenzar a descubrir agentes.",
    dialogTitle: "Registrar conector",
    dialogDesc:
      "Conecta una plataforma real. La credencial se prueba al momento y queda almacenada solo en tu base de datos — nunca se muestra de vuelta.",
    platformLabel: "Plataforma",
    platformsSoon: "AWS Bedrock, Azure AI y Vertex llegan en las próximas iteraciones del R3.",
    nameLabel: "Nombre del conector",
    namePlaceholder: "ej.: GitHub — org principal",
    tokenLabel: "Token (PAT)",
    tokenPlaceholder: "ghp_… (opcional — vacío usa el GITHUB_TOKEN del entorno)",
    scopePre: "Alcance mínimo: lectura de repositorios. Un fine-grained PAT con",
    scopePost: "es suficiente.",
    cancel: "Cancelar",
    testing: "Probando conexión…",
    registerTest: "Registrar y probar",
  },
};

export default function ConnectorsPage() {
  const { data: connectors, isLoading, isError, refetch } = useListConnectors();
  const { toast } = useToast();
  const { lang } = useLang();
  const t = L[lang];
  const locale = localeOf(lang);

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
            title: r.test.ok ? t.toastRegOk : t.toastRegPending,
            description: r.test.message,
            variant: r.test.ok ? undefined : "destructive",
          });
          setRegisterOpen(false);
          setRegForm({ platform: "github", name: "", token: "" });
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
        onError: () =>
          toast({ title: t.toastRegErr, variant: "destructive" }),
      },
    );
  };

  const handleConnect = (platform: string) => {
    connectPlatform.mutate(
      { data: { platform } },
      {
        onSuccess: () => {
          toast({ title: t.toastLinked, description: t.toastLinkedDesc(platform) });
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
          toast({ title: t.toastDiscoveryDone, description: t.toastDiscoveryDesc(result.agentsFound) });
        },
        onError: () => {
          setDiscoveringId(null);
          toast({ title: t.toastErr, description: t.toastDiscoveryFail, variant: "destructive" });
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
          toast({ title: t.toastImportDone, description: t.toastImportDesc });
          setDiscoveryResult(null);
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        },
      },
    );
  };

  return (
    <AppLayout breadcrumbs={[{ label: t.bcAccount }, { label: t.bcConnectors }]}>
      <div className="max-w-4xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
          action={
            <Button onClick={() => setRegisterOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t.registerBtn}
            </Button>
          }
        />

        {discoveryResult && (
          <Card className="overflow-hidden border-primary/30">
            <div className="border-b border-card-border bg-primary/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-serif text-lg font-medium">
                  {t.discoveryTitle} · {discoveryResult.platform}
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
                      <span>{t.metricsMapped(agent.proposedMetrics.length)}</span>
                      <span>{t.confidence(agent.confidence)}</span>
                    </div>
                  </div>
                  {agent.alreadyImported ? (
                    <Pill tone="sage">{t.alreadyInFleet}</Pill>
                  ) : (
                    <Button size="sm" onClick={() => handleImport([agent.externalId])}>
                      <Download className="mr-1 h-4 w-4" />
                      {t.importAdmit}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-card-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setDiscoveryResult(null)}>
                {t.close}
              </Button>
            </div>
          </Card>
        )}

        {isError ? (
          <ErrorState title={t.errLoad} onRetry={() => refetch()} />
        ) : (
          <Card className="overflow-hidden">
            <div className="border-b border-card-border px-5 py-3">
              <Eyebrow>{t.availableIntegrations}</Eyebrow>
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
                              {connected ? t.connected : t.available}
                            </Pill>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {connected
                              ? t.connectedMeta(
                                  connector.agentsDiscovered,
                                  connector.lastSyncAt
                                    ? new Date(connector.lastSyncAt).toLocaleDateString(locale)
                                    : t.never,
                                )
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
                              t.discovering
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" /> {t.runDiscovery}
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnect(connector.platform)}
                            disabled={connectPlatform.isPending}
                          >
                            <Link2 className="mr-2 h-4 w-4" /> {t.connect}
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
                <p className="font-medium text-foreground">{t.emptyTitle}</p>
                <p className="text-sm">{t.emptyDesc}</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Cadastro de conector real (R3) */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
            <DialogDescription>
              {t.dialogDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.platformLabel}</Label>
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
                {t.platformsSoon}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-name">{t.nameLabel}</Label>
              <Input
                id="reg-name"
                value={regForm.name}
                placeholder={t.namePlaceholder}
                onChange={(e) => setRegForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-token">{t.tokenLabel}</Label>
              <Input
                id="reg-token"
                type="password"
                value={regForm.token}
                placeholder={t.tokenPlaceholder}
                onChange={(e) => setRegForm((p) => ({ ...p, token: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {t.scopePre}{" "}
                <code className="font-mono">contents:read</code> {t.scopePost}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleRegister}
              disabled={!regForm.name.trim() || registerConnector.isPending}
            >
              {registerConnector.isPending ? t.testing : t.registerTest}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
