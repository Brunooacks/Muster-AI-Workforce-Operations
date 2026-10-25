import { useState } from "react";
import {
  useCreateAgentContract,
  useListAgentContracts,
  getListAgentContractsQueryKey,
  type AgentContract,
  type AgentContractOwnerCandidate,
} from "@workspace/api-client-react";
import { FileSignature, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow, Pill } from "@/components/cohort";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_CONTRACT_FORM,
  contractBodyFromForm,
  contractFormErrors,
  formFromContract,
  type ContractFormField,
  type ContractFormState,
} from "@/lib/agent-contract-form";

/**
 * Contrato numérico versionado (cunha · C2.2). Substitui as strings do
 * business case: cada salvamento é uma versão nova; as antigas ficam no
 * histórico e o veredito aponta para a versão que vigorava.
 */

interface LegacyBusinessCase {
  baseline?: string;
  targetPayback?: string;
  actualPayback?: string;
  description?: string;
}

function ownerLabel(id: string, owners: AgentContractOwnerCandidate[]) {
  const o = owners.find((c) => c.id === id);
  return o ? `${o.userId} · ${o.role}` : id;
}

function ContractNumbers({ c }: { c: AgentContract }) {
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-foreground/90">{value}</span>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {row("Métrica", `${c.metricKey} (${c.unit}, ${c.direction === "down" ? "menor é melhor" : "maior é melhor"})`)}
      {row("Linha de base → meta", `${c.baseline} → ${c.target}`)}
      {c.limit !== null && row("Limite", String(c.limit))}
      {row("Prazo", c.deadline)}
      {row("Min. humanos de referência", c.referenceHumanMinutes === null ? "não informado" : String(c.referenceHumanMinutes))}
      {row("Aceite", c.requireHumanAccept ? "exige humano" : "humano ou automático")}
      {row("Modelo de referência", c.referenceModel ?? "o mais barato aprovado")}
    </div>
  );
}

export function AgentContractPanel({ agentId, legacy }: { agentId: string; legacy: LegacyBusinessCase }) {
  const { toast } = useToast();
  const queryKey = getListAgentContractsQueryKey(agentId);
  const { data, isLoading, isError } = useListAgentContracts(agentId, { query: { queryKey, enabled: !!agentId } });
  const create = useCreateAgentContract();
  const [form, setForm] = useState<ContractFormState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const errors = form ? contractFormErrors(form, today) : {};
  const owners = data?.ownerCandidates ?? [];
  const active = data?.active ?? null;
  const legacyText = [legacy.baseline, legacy.targetPayback, legacy.actualPayback].some((v) => v?.trim());

  const field = (key: ContractFormField, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`contract-${key}`} className="text-xs">
        {label}
        {errors[key] && <span className="ml-1 text-destructive">({errors[key]})</span>}
      </Label>
      <Input
        id={`contract-${key}`}
        value={String(form?.[key] ?? "")}
        aria-invalid={Boolean(errors[key])}
        onChange={(e) => form && setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
    </div>
  );

  const save = () => {
    if (!form || Object.keys(errors).length > 0) return;
    create.mutate(
      { agentId, data: contractBodyFromForm(form) },
      {
        onSuccess: () => {
          toast({ title: "Nova versão do contrato salva" });
          setForm(null);
          void queryClient.invalidateQueries({ queryKey });
        },
        onError: () => toast({ title: "Não foi possível salvar o contrato", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-3 text-sm">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando contrato…</p>
      ) : isError ? (
        <p className="text-xs text-destructive">Contrato indisponível.</p>
      ) : active ? (
        <>
          <div className="flex items-center gap-2">
            <Pill tone="sage">v{active.version} vigente</Pill>
            <span className="truncate text-[11px] text-muted-foreground">dono {ownerLabel(active.ownerMemberId, owners)}</span>
          </div>
          <ContractNumbers c={active} />
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Pill tone="ochre">Contrato pendente</Pill>
          <span className="text-[11px] text-muted-foreground">sem meta numérica</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setForm(active ? formFromContract(active) : { ...EMPTY_CONTRACT_FORM })}
        >
          <FileSignature className="mr-1.5 h-3.5 w-3.5" />
          {active ? "Nova versão" : "Definir contrato"}
        </Button>
        {(data?.versions.length ?? 0) > 1 && (
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
            <History className="mr-1.5 h-3.5 w-3.5" />
            Histórico ({data!.versions.length})
          </Button>
        )}
      </div>

      {showHistory && (
        <ol className="space-y-2 border-t border-card-border pt-3">
          {data!.versions.map((v) => (
            <li key={`${v.id}-${v.version}`} className="text-[12px] text-foreground/80">
              <span className="font-mono">v{v.version}</span> · {v.baseline} → {v.target} {v.unit} · {v.status}
              {v.supersededAt && ` em ${v.supersededAt.slice(0, 10)}`}
            </li>
          ))}
        </ol>
      )}

      {(legacy.description || legacyText) && (
        <div className="space-y-1.5 border-t border-card-border pt-3">
          <Eyebrow>Business case (texto de referência)</Eyebrow>
          {legacy.description && <p className="text-[12px] italic leading-snug text-foreground/70">{legacy.description}</p>}
          {legacyText && (
            <p className="text-[12px] leading-snug text-foreground/70">
              baseline {legacy.baseline || "—"} · payback meta {legacy.targetPayback || "—"} · real {legacy.actualPayback || "—"}
            </p>
          )}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{active ? `Contrato v${active.version + 1}` : "Contrato v1"}</DialogTitle>
            <DialogDescription>
              Cada salvamento cria uma versão nova; a anterior fica no histórico e os vereditos continuam apontando para ela.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              {field("metricKey", "Métrica")}
              {field("unit", "Unidade")}
              <div className="space-y-1">
                <Label htmlFor="contract-direction" className="text-xs">Direção</Label>
                <select
                  id="contract-direction"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as "up" | "down" })}
                  className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"
                >
                  <option value="down">Menor é melhor</option>
                  <option value="up">Maior é melhor</option>
                </select>
              </div>
              {field("deadline", "Prazo", { type: "date", min: today })}
              {field("baseline", "Linha de base", { inputMode: "decimal" })}
              {field("target", "Meta", { inputMode: "decimal" })}
              {field("limit", "Limite (opcional)", { inputMode: "decimal" })}
              {field("referenceHumanMinutes", "Min. humanos de referência", { inputMode: "decimal" })}
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="contract-owner" className="text-xs">
                  Responsável
                  {errors.ownerMemberId && <span className="ml-1 text-destructive">({errors.ownerMemberId})</span>}
                </Label>
                <select
                  id="contract-owner"
                  value={form.ownerMemberId}
                  onChange={(e) => setForm({ ...form, ownerMemberId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground"
                >
                  <option value="">Selecione um membro da conta</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>{o.userId} · {o.role}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">{field("referenceModel", "Modelo de referência (opcional)")}</div>
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.requireHumanAccept}
                  onChange={(e) => setForm({ ...form, requireHumanAccept: e.target.checked })}
                />
                Exigir aceite humano (aceite automático não conta como tarefa aceita)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} disabled={create.isPending || Object.keys(errors).length > 0}>
              Salvar versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
