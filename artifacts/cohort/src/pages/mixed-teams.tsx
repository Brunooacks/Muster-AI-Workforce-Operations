import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading, Eyebrow, Pill } from "@/components/cohort";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/lib/i18n";
import { Bot, CheckCircle2, Plus, Users, Target, ShieldCheck } from "lucide-react";

type Purpose = { id: string; key: string; name: string; domain: string; outcome: string; riskTier: string };
type Team = { id: string; name: string; slug: string; purposeId: string; memberCount: number; agentCount: number };
type KpiContract = { key: string; domain: string; label: string; layer: string; target?: string; purpose: string; guardrail: boolean };
type PerformancePayload = { domains: Array<{ key: string; label: string; description: string; icon: string }>; contracts: KpiContract[]; total: number };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível carregar os dados");
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Não foi possível salvar");
  return response.json() as Promise<T>;
}

export default function MixedTeamsPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const [purposeName, setPurposeName] = useState("Atendimento resolutivo");
  const [purposeDomain, setPurposeDomain] = useState("atendimento");
  const [purposeOutcome, setPurposeOutcome] = useState("Resolver solicitações com qualidade e escalonamento seguro");
  const [teamName, setTeamName] = useState("Squad Atendimento Híbrido");
  const [selectedPurposeId, setSelectedPurposeId] = useState("");
  const [saving, setSaving] = useState(false);

  const purposes = useQuery({ queryKey: ["mixed-purposes"], queryFn: () => getJson<Purpose[]>("/api/purposes") });
  const teams = useQuery({ queryKey: ["mixed-teams"], queryFn: () => getJson<Team[]>("/api/teams") });
  const performance = useQuery({ queryKey: ["performance-kpi-contracts"], queryFn: () => getJson<PerformancePayload>("/api/performance/kpi-contracts") });

  const activePurposeId = selectedPurposeId || purposes.data?.[0]?.id || "";
  const groupedKpis = useMemo(() => {
    const groups = new Map<string, KpiContract[]>();
    for (const contract of performance.data?.contracts ?? []) {
      groups.set(contract.domain, [...(groups.get(contract.domain) ?? []), contract]);
    }
    return groups;
  }, [performance.data?.contracts]);

  async function createPurpose() {
    setSaving(true);
    try {
      const purpose = await postJson<Purpose>("/api/purposes", {
        key: purposeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        name: purposeName,
        domain: purposeDomain,
        outcome: purposeOutcome,
        riskTier: "medium",
      });
      setSelectedPurposeId(purpose.id);
      await purposes.refetch();
      toast({ title: "Propósito criado", description: "Agora ele pode receber um time misto." });
    } catch (error) {
      toast({ title: "Não foi possível criar o propósito", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function createTeam() {
    if (!activePurposeId) {
      toast({ title: "Selecione ou crie um propósito", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await postJson<Team>("/api/teams", { name: teamName, purposeId: activePurposeId });
      await teams.refetch();
      toast({ title: "Time misto criado", description: "O próximo passo é adicionar pessoas e agentes." });
    } catch (error) {
      toast({ title: "Não foi possível criar o time", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout breadcrumbs={[{ label: lang === "pt" ? "Operação" : "Operations" }, { label: lang === "pt" ? "Equipes mistas" : "Mixed teams" }]}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeading
          eyebrow="Performance operacional"
          title="Equipes mistas"
          subtitle="Conecte propósito, pessoas, agentes e KPIs antes de avaliar performance. Esta é a primeira fatia do modelo humano-agente."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-card-border/80 bg-card/90">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Target className="h-4 w-4 text-chart-1" />Propósito</CardTitle><CardDescription>Qual outcome o time precisa produzir?</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="purpose-name">Nome</Label><Input id="purpose-name" value={purposeName} onChange={(event) => setPurposeName(event.target.value)} />
              <Label htmlFor="purpose-domain">Domínio</Label><Input id="purpose-domain" value={purposeDomain} onChange={(event) => setPurposeDomain(event.target.value)} />
              <Label htmlFor="purpose-outcome">Outcome esperado</Label><Input id="purpose-outcome" value={purposeOutcome} onChange={(event) => setPurposeOutcome(event.target.value)} />
              <Button onClick={createPurpose} disabled={saving || !purposeName || !purposeOutcome} className="w-full"><Plus className="mr-2 h-4 w-4" />Criar propósito</Button>
            </CardContent>
          </Card>

          <Card className="border-card-border/80 bg-card/90">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-4 w-4 text-chart-2" />Time humano-agente</CardTitle><CardDescription>O contêiner de responsabilidade e decisão.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="team-name">Nome do time</Label><Input id="team-name" value={teamName} onChange={(event) => setTeamName(event.target.value)} />
              <Label htmlFor="team-purpose">Propósito associado</Label>
              <select id="team-purpose" value={activePurposeId} onChange={(event) => setSelectedPurposeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground">
                <option value="">Selecione um propósito</option>
                {(purposes.data ?? []).map((purpose) => <option key={purpose.id} value={purpose.id}>{purpose.name}</option>)}
              </select>
              <Button onClick={createTeam} disabled={saving || !activePurposeId || !teamName} className="w-full"><Plus className="mr-2 h-4 w-4" />Criar time</Button>
              <div className="rounded-lg border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground">Depois: adicionar owner, supervisor, operador, observador e agentes com responsabilidades explícitas.</div>
            </CardContent>
          </Card>

          <Card className="border-card-border/80 bg-card/90">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-4 w-4 text-chart-3" />Regra de decisão</CardTitle><CardDescription>O score não substitui guardrails.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-1" /><span>Resultado precisa estar ligado ao propósito.</span></div>
              <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-1" /><span>Guardrail crítico bloqueia promoção.</span></div>
              <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-1" /><span>Comparação exige baseline e confiança.</span></div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-card-border/80 bg-card/90">
          <CardHeader><CardTitle>KPIs por domínio</CardTitle><CardDescription>{performance.data?.total ?? 0} contratos de KPI propostos para a primeira avaliação end-to-end.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {(performance.data?.domains ?? []).map((domain) => (
              <div key={domain.key} className="rounded-xl border border-border/70 bg-secondary/15 p-4">
                <div className="mb-3 flex items-center justify-between"><div><Eyebrow>{domain.label}</Eyebrow><p className="mt-1 text-xs text-muted-foreground">{domain.description}</p></div><Bot className="h-5 w-5 text-chart-1" /></div>
                <div className="space-y-2">
                  {(groupedKpis.get(domain.key) ?? []).map((kpi) => <div key={kpi.key} className="flex items-center justify-between gap-3 border-t border-border/50 pt-2 text-sm"><span className="text-foreground">{kpi.label}</span><span className="flex items-center gap-2"><Pill tone={kpi.guardrail ? "terracotta" : "muted"}>{kpi.guardrail ? "guardrail" : kpi.layer}</Pill><span className="font-mono text-xs text-muted-foreground">{kpi.target ?? "—"}</span></span></div>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-card-border/80 bg-card/90">
          <CardHeader><CardTitle>Times criados</CardTitle><CardDescription>O modelo passa a ter uma unidade de performance acima do agente isolado.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {(teams.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum time criado ainda.</p> : (teams.data ?? []).map((team) => <div key={team.id} className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3"><div><p className="font-medium text-foreground">{team.name}</p><p className="text-xs text-muted-foreground">{team.memberCount} pessoas · {team.agentCount} agentes</p></div><Pill tone="sage">ativo</Pill></div>)}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
