import { useState } from "react";
import {
  useCreateOffInvoiceCost,
  useCreateRoleRate,
  useListAgents,
  useListAreas,
  useListOffInvoiceCosts,
  useListProjects,
  useListRoleRates,
  getListOffInvoiceCostsQueryKey,
  getListRoleRatesQueryKey,
  type OffInvoiceCostInputAllocation,
  type OffInvoiceCostInputCategory,
} from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/cohort";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCents, roleRateBody, toCents, type RoleRateForm } from "@/lib/rates-form";

/**
 * Configurações · custo-hora e custos fora da fatura (cunha · C3.2). Só admin
 * (a API responde 403 para os demais). Sem custo-hora a camada 1 do agente
 * mostra "indisponível" — não há valor padrão.
 */

const SELECT = "h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground";
const CATEGORY_LABEL: Record<OffInvoiceCostInputCategory, string> = {
  license: "Licença",
  infra: "Infra",
  integration: "Integração",
  other: "Outro",
};
const ALLOCATION_LABEL: Record<OffInvoiceCostInputAllocation, string> = {
  per_task: "Rateio por tarefas",
  agent: "Agente",
  project: "Projeto",
};

function forbidden(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status: number }).status === 403;
}

const EMPTY_RATE: RoleRateForm = { role: "", areaId: "", hourly: "", currency: "BRL", validFrom: "", validTo: "" };

export function RatesSettings() {
  const { toast } = useToast();
  const rates = useListRoleRates({ query: { queryKey: getListRoleRatesQueryKey(), retry: false } });
  const costs = useListOffInvoiceCosts({ query: { queryKey: getListOffInvoiceCostsQueryKey(), retry: false } });
  const areas = useListAreas();
  const agents = useListAgents();
  const projects = useListProjects();
  const createRate = useCreateRoleRate();
  const createCost = useCreateOffInvoiceCost();
  const [rate, setRate] = useState<RoleRateForm>(EMPTY_RATE);
  const [rateErrors, setRateErrors] = useState<string[]>([]);
  const [cost, setCost] = useState({
    category: "license" as OffInvoiceCostInputCategory,
    amount: "",
    currency: "BRL" as "BRL" | "USD",
    periodStart: "",
    periodEnd: "",
    allocation: "per_task" as OffInvoiceCostInputAllocation,
    target: "",
    description: "",
  });

  if (forbidden(rates.error)) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        Apenas administradores da conta veem e alteram custo-hora e custos fora da fatura.
      </Card>
    );
  }

  const areaName = (id: string | null) => (id ? (areas.data?.areas ?? []).find((a) => a.id === id)?.name ?? id : "Toda a conta");

  const saveRate = () => {
    const { errors, body } = roleRateBody(rate);
    setRateErrors(errors);
    if (!body) return;
    createRate.mutate(
      { data: body },
      {
        onSuccess: () => {
          setRate(EMPTY_RATE);
          toast({ title: "Custo-hora salvo" });
          void queryClient.invalidateQueries({ queryKey: getListRoleRatesQueryKey() });
        },
        onError: (e) =>
          toast({
            title: "Não foi possível salvar",
            description: typeof e === "object" && e && "status" in e && e.status === 409 ? "Já existe vigência que cruza este período." : undefined,
            variant: "destructive",
          }),
      },
    );
  };

  const amountCents = toCents(cost.amount);
  const costValid =
    amountCents !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(cost.periodStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(cost.periodEnd) &&
    cost.periodEnd >= cost.periodStart &&
    (cost.allocation === "per_task" || cost.target !== "");

  const saveCost = () => {
    if (!costValid) return;
    createCost.mutate(
      {
        data: {
          category: cost.category,
          amountCents: amountCents!,
          currency: cost.currency,
          periodStart: cost.periodStart,
          periodEnd: cost.periodEnd,
          allocation: cost.allocation,
          agentId: cost.allocation === "agent" ? cost.target : null,
          projectId: cost.allocation === "project" ? cost.target : null,
          description: cost.description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setCost({ ...cost, amount: "", description: "" });
          toast({ title: "Custo fora da fatura salvo" });
          void queryClient.invalidateQueries({ queryKey: getListOffInvoiceCostsQueryKey() });
        },
        onError: () => toast({ title: "Não foi possível salvar", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">Custo-hora e custos fora da fatura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Base da camada 1 (custo por resultado validado). Cada valor tem vigência; alterações ficam na trilha da conta.
        </p>
      </div>

      {rates.data && rates.data.length === 0 && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-chart-2/40 bg-chart-2/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chart-2-text" />
          <span>Sem custo-hora cadastrado: o custo por resultado dos agentes aparece como “indisponível”. Não usamos valor padrão.</span>
        </div>
      )}

      <Card className="space-y-4 p-5">
        <Eyebrow>Custo-hora por papel</Eyebrow>
        {(rates.data ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1.5">Papel</th><th>Área</th><th className="text-right">Custo-hora</th><th>Vigência</th></tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {rates.data!.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2">{r.role}</td>
                    <td>{areaName(r.areaId)}</td>
                    <td className="text-right font-mono">{formatCents(r.hourlyCostCents, r.currency)}</td>
                    <td className="font-mono text-xs">{r.validFrom} → {r.validTo ?? "aberta"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label htmlFor="rate-role" className="text-xs">Papel</Label><Input id="rate-role" value={rate.role} onChange={(e) => setRate({ ...rate, role: e.target.value })} /></div>
          <div className="space-y-1">
            <Label htmlFor="rate-area" className="text-xs">Área</Label>
            <select id="rate-area" className={SELECT} value={rate.areaId} onChange={(e) => setRate({ ...rate, areaId: e.target.value })}>
              <option value="">Toda a conta</option>
              {(areas.data?.areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1"><Label htmlFor="rate-hourly" className="text-xs">Custo-hora</Label><Input id="rate-hourly" inputMode="decimal" value={rate.hourly} onChange={(e) => setRate({ ...rate, hourly: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="rate-currency" className="text-xs">Moeda</Label>
              <select id="rate-currency" className={SELECT} value={rate.currency} onChange={(e) => setRate({ ...rate, currency: e.target.value as "BRL" | "USD" })}><option>BRL</option><option>USD</option></select>
            </div>
          </div>
          <div className="space-y-1"><Label htmlFor="rate-from" className="text-xs">Início da vigência</Label><Input id="rate-from" type="date" value={rate.validFrom} onChange={(e) => setRate({ ...rate, validFrom: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="rate-to" className="text-xs">Fim (opcional)</Label><Input id="rate-to" type="date" value={rate.validTo} onChange={(e) => setRate({ ...rate, validTo: e.target.value })} /></div>
          <div className="flex items-end"><Button className="w-full" onClick={saveRate} disabled={createRate.isPending}>Adicionar custo-hora</Button></div>
        </div>
        {rateErrors.length > 0 && <p className="text-xs text-destructive-text">{rateErrors.join(" ")}</p>}
      </Card>

      <Card className="space-y-4 p-5">
        <Eyebrow>Custos fora da fatura</Eyebrow>
        {(costs.data ?? []).length > 0 && (
          <ul className="divide-y divide-card-border text-sm">
            {costs.data!.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{CATEGORY_LABEL[c.category]} · {ALLOCATION_LABEL[c.allocation]}{c.description ? ` · ${c.description}` : ""}</span>
                <span className="font-mono text-xs">{formatCents(c.amountCents, c.currency)} · {c.periodStart} → {c.periodEnd}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label htmlFor="cost-category" className="text-xs">Categoria</Label>
            <select id="cost-category" className={SELECT} value={cost.category} onChange={(e) => setCost({ ...cost, category: e.target.value as OffInvoiceCostInputCategory })}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1"><Label htmlFor="cost-amount" className="text-xs">Valor</Label><Input id="cost-amount" inputMode="decimal" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="cost-currency" className="text-xs">Moeda</Label>
              <select id="cost-currency" className={SELECT} value={cost.currency} onChange={(e) => setCost({ ...cost, currency: e.target.value as "BRL" | "USD" })}><option>BRL</option><option>USD</option></select>
            </div>
          </div>
          <div className="space-y-1"><Label htmlFor="cost-allocation" className="text-xs">Alocação</Label>
            <select id="cost-allocation" className={SELECT} value={cost.allocation} onChange={(e) => setCost({ ...cost, allocation: e.target.value as OffInvoiceCostInputAllocation, target: "" })}>
              {Object.entries(ALLOCATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {cost.allocation !== "per_task" && (
            <div className="space-y-1 sm:col-span-3"><Label htmlFor="cost-target" className="text-xs">{cost.allocation === "agent" ? "Agente" : "Projeto"}</Label>
              <select id="cost-target" className={SELECT} value={cost.target} onChange={(e) => setCost({ ...cost, target: e.target.value })}>
                <option value="">Selecione</option>
                {cost.allocation === "agent"
                  ? (agents.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)
                  : (projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1"><Label htmlFor="cost-start" className="text-xs">Início</Label><Input id="cost-start" type="date" value={cost.periodStart} onChange={(e) => setCost({ ...cost, periodStart: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="cost-end" className="text-xs">Fim</Label><Input id="cost-end" type="date" value={cost.periodEnd} onChange={(e) => setCost({ ...cost, periodEnd: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="cost-desc" className="text-xs">Descrição (opcional)</Label><Input id="cost-desc" value={cost.description} onChange={(e) => setCost({ ...cost, description: e.target.value })} /></div>
          <div className="flex items-end sm:col-span-3"><Button onClick={saveCost} disabled={!costValid || createCost.isPending}>Adicionar custo</Button></div>
        </div>
      </Card>
    </div>
  );
}
