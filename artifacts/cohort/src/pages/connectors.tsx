import { AppLayout } from "@/components/layout";
import { useListConnectors, useConnectPlatform, useDiscoverAgents, useImportDiscoveredAgents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, Search, Check, Download, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getListConnectorsQueryKey } from "@workspace/api-client-react";

export default function ConnectorsPage() {
  const { data: connectors, isLoading } = useListConnectors();
  const { toast } = useToast();
  
  const connectPlatform = useConnectPlatform();
  const discoverAgents = useDiscoverAgents();
  const importAgents = useImportDiscoveredAgents();

  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);

  const handleConnect = (platform: string) => {
    connectPlatform.mutate(
      { data: { platform } },
      {
        onSuccess: () => {
          toast({ title: "Conector vinculado", description: `Conexão com ${platform} estabelecida.` });
          queryClient.invalidateQueries({ queryKey: getListConnectorsQueryKey() });
        }
      }
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
        }
      }
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
        }
      }
    );
  };

  return (
    <AppLayout title="Conectores">
      <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Plug-and-Play Discovery</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Conecte plataformas para descobrir agentes e importar suas métricas propostas automaticamente.
          </p>
        </div>

        {discoveryResult && (
          <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Discovery Result: {discoveryResult.platform}
              </CardTitle>
              <CardDescription>{discoveryResult.coverageNote}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {discoveryResult.agents.map((agent: any) => (
                  <div key={agent.externalId} className="p-4 bg-card border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-medium">{agent.name} <Badge variant="outline" className="ml-2">{agent.role}</Badge></div>
                      <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                        <span>{agent.proposedMetrics.length} métricas mapeadas</span>
                        <span>• Confiança: {agent.confidence}%</span>
                      </div>
                    </div>
                    {agent.alreadyImported ? (
                      <Badge variant="secondary">Já na Frota</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleImport([agent.externalId])}>
                        <Download className="h-4 w-4 mr-1" />
                        Importar & Admitir
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
               <Button variant="outline" onClick={() => setDiscoveryResult(null)}>Fechar</Button>
            </CardFooter>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {isLoading ? (
            <Card><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded"></div></CardContent></Card>
          ) : connectors?.map(connector => (
            <Card key={connector.id} className="flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{connector.name}</CardTitle>
                    <CardDescription>{connector.category}</CardDescription>
                  </div>
                  <Badge variant={connector.status === 'connected' ? 'default' : 'secondary'}>
                    {connector.status === 'connected' ? 'Conectado' : 'Disponível'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                {connector.status === 'connected' && (
                  <div className="text-sm flex flex-col gap-1 text-muted-foreground">
                    <span><strong className="text-foreground">{connector.agentsDiscovered}</strong> agentes descobertos</span>
                    <span>Último sync: {connector.lastSyncAt ? new Date(connector.lastSyncAt).toLocaleDateString() : 'Nunca'}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-0 border-t mt-auto p-4 bg-muted/20">
                {connector.status === 'connected' ? (
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => handleDiscover(connector.id)}
                    disabled={discoveringId === connector.id}
                  >
                    {discoveringId === connector.id ? (
                      "Descobrindo..."
                    ) : (
                      <><Search className="h-4 w-4 mr-2" /> Rodar Discovery</>
                    )}
                  </Button>
                ) : (
                  <Button 
                    className="w-full" 
                    onClick={() => handleConnect(connector.platform)}
                    disabled={connectPlatform.isPending}
                  >
                    <Link2 className="h-4 w-4 mr-2" /> Conectar
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
