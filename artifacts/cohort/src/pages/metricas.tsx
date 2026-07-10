import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useListCatalogMetrics,
  useCreateCatalogMetric,
  useUpdateCatalogMetric,
  useDeleteCatalogMetric,
  getListCatalogMetricsQueryKey,
} from "@workspace/api-client-react";
import type { CatalogMetric, CatalogVertical } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ErrorState } from "@/components/query-state";
import { PageHeading, Eyebrow, FilterChip, Pill } from "@/components/cohort";
import { LAYER_ICON } from "@/components/carteira";
import {
  Briefcase,
  Cpu,
  Workflow,
  Headset,
  ShieldCheck,
  Wallet,
  Layers,
  Plus,
  Pencil,
  Trash2,
  Activity,
  type LucideIcon,
} from "lucide-react";

/* Vertical icons come from the API as lucide names — resolve locally. */
const VERTICAL_ICON: Record<string, LucideIcon> = {
  Briefcase,
  Cpu,
  Workflow,
  Headset,
  ShieldCheck,
  Wallet,
  Layers,
};

const LAYER_LABEL: Record<string, string> = {
  efficacy: "Eficácia",
  efficiency: "Eficiência",
  adoption: "Adoção",
  governance: "Governança",
  value: "Valor",
};

const LAYER_ORDER = ["efficacy", "efficiency", "adoption", "governance", "value"] as const;

type MetricForm = {
  key?: string; // present when editing
  isCustom: boolean;
  vertical: string;
  layer: string;
  label: string;
  unit: string;
  target: string;
  description: string;
  rationale: string;
};

const EMPTY_FORM = (vertical: string): MetricForm => ({
  isCustom: true,
  vertical,
  layer: "efficacy",
  label: "",
  unit: "%",
  target: "",
  description: "",
  rationale: "",
});

export default function MetricasPage() {
  const { toast } = useToast();
  const { data: verticals, isLoading, isError, refetch } = useListCatalogMetrics();
  const createMetric = useCreateCatalogMetric();
  const updateMetric = useUpdateCatalogMetric();
  const deleteMetric = useDeleteCatalogMetric();

  const [activeVertical, setActiveVertical] = useState<string>("negocios");
  const [form, setForm] = useState<MetricForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CatalogMetric | null>(null);

  const current: CatalogVertical | undefined = useMemo(
    () => verticals?.find((v) => v.key === activeVertical) ?? verticals?.[0],
    [verticals, activeVertical],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCatalogMetricsQueryKey() });

  const handleSave = () => {
    if (!form || !form.label.trim()) return;
    const common = {
      layer: form.layer as CatalogMetric["layer"],
      label: form.label.trim(),
      unit: form.unit.trim(),
      target: form.target.trim() || "—",
      description: form.description.trim(),
      rationale: form.rationale.trim(),
    };
    if (form.key) {
      updateMetric.mutate(
        { metricKey: form.key, data: common },
        {
          onSuccess: () => {
            toast({ title: "Métrica atualizada" });
            setForm(null);
            invalidate();
          },
          onError: () => toast({ title: "Erro ao atualizar métrica", variant: "destructive" }),
        },
      );
    } else {
      createMetric.mutate(
        { data: { ...common, vertical: form.vertical } },
        {
          onSuccess: () => {
            toast({ title: "Métrica criada" });
            setForm(null);
            invalidate();
          },
          onError: () => toast({ title: "Erro ao criar métrica", variant: "destructive" }),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteMetric.mutate(
      { metricKey: confirmDelete.key },
      {
        onSuccess: () => {
          toast({ title: "Métrica excluída" });
          setConfirmDelete(null);
          invalidate();
        },
        onError: () =>
          toast({
            title: "Não foi possível excluir",
            description: "Métricas do catálogo padrão não podem ser excluídas.",
            variant: "destructive",
          }),
      },
    );
  };

  const totalMetrics = verticals?.reduce((n, v) => n + v.metrics.length, 0) ?? 0;

  return (
    <AppLayout breadcrumbs={[{ label: "Governança" }, { label: "Métricas" }]}>
      <div className="space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Governança"
          title="Biblioteca de Métricas"
          subtitle={`Catálogo profundo por vertical de negócio — ${totalMetrics} métricas prontas, mais as suas tailor-made. Toda métrica declara camada, meta e o racional que sustenta o veredito.`}
          action={
            <Button onClick={() => setForm(EMPTY_FORM(current?.key ?? "negocios"))}>
              <Plus className="mr-2 h-4 w-4" />
              Nova métrica
            </Button>
          }
        />

        {isError ? (
          <ErrorState title="Não foi possível carregar o catálogo" onRetry={() => refetch()} />
        ) : isLoading || !verticals ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-2xl rounded-full" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Vertical selector */}
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>Vertical</Eyebrow>
              {verticals.map((v) => (
                <FilterChip
                  key={v.key}
                  active={(current?.key ?? "") === v.key}
                  onClick={() => setActiveVertical(v.key)}
                  count={v.metrics.length}
                >
                  {v.label}
                </FilterChip>
              ))}
            </div>

            {current && (
              <section>
                <div className="mb-5 flex items-start gap-3">
                  {(() => {
                    const Icon = VERTICAL_ICON[current.icon] ?? Layers;
                    return (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="font-serif text-2xl font-medium tracking-tight">{current.label}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{current.description}</p>
                  </div>
                </div>

                {/* One card per layer, Trincheira metric rows */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {LAYER_ORDER.map((layerKey) => {
                    const metrics = current.metrics.filter((m) => m.layer === layerKey);
                    if (metrics.length === 0) return null;
                    const Icon = LAYER_ICON[layerKey] ?? Activity;
                    return (
                      <div key={layerKey} className="rounded-xl border border-card-border bg-card p-5">
                        <div className="mb-3 flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                          <h3 className="font-serif text-lg font-medium leading-none tracking-tight">
                            {LAYER_LABEL[layerKey]}
                          </h3>
                        </div>
                        <div>
                          {metrics.map((m) => (
                            <div
                              key={m.key}
                              className="group border-b border-card-border/60 py-2.5 last:border-0"
                              title={m.description}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[13px] leading-tight text-foreground/90">
                                      {m.label}
                                    </span>
                                    {m.isCustom && <Pill tone="blue">Custom</Pill>}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                                    {m.target}
                                    {m.unit ? ` · ${m.unit}` : ""}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    type="button"
                                    aria-label="Editar métrica"
                                    onClick={() =>
                                      setForm({
                                        key: m.key,
                                        isCustom: m.isCustom,
                                        vertical: m.vertical,
                                        layer: m.layer,
                                        label: m.label,
                                        unit: m.unit,
                                        target: m.target,
                                        description: m.description,
                                        rationale: m.rationale,
                                      })
                                    }
                                    className="rounded-md p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {m.isCustom && (
                                    <button
                                      type="button"
                                      aria-label="Excluir métrica"
                                      onClick={() => setConfirmDelete(m)}
                                      className="rounded-md p-1 text-muted-foreground/60 hover:bg-muted hover:text-chart-4"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {m.rationale && (
                                <p className="mt-1 text-[11px] italic leading-snug text-muted-foreground">
                                  {m.rationale}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.key ? "Editar métrica" : "Nova métrica tailor-made"}</DialogTitle>
            <DialogDescription>
              {form?.key && !form.isCustom
                ? "Métrica do catálogo padrão: apenas meta, descrição e racional são editáveis."
                : "Defina a métrica no vocabulário do seu negócio. Ela fica disponível na admissão e nas avaliações."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Vertical</Label>
                  <Select
                    value={form.vertical}
                    onValueChange={(v) => setForm((p) => (p ? { ...p, vertical: v } : p))}
                    disabled={!!form.key}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(verticals ?? []).map((v) => (
                        <SelectItem key={v.key} value={v.key}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Camada</Label>
                  <Select
                    value={form.layer}
                    onValueChange={(v) => setForm((p) => (p ? { ...p, layer: v } : p))}
                    disabled={!!form.key && !form.isCustom}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LAYER_ORDER.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LAYER_LABEL[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-label">Nome da métrica</Label>
                <Input
                  id="m-label"
                  value={form.label}
                  placeholder="ex.: Propostas geradas por semana"
                  disabled={!!form.key && !form.isCustom}
                  onChange={(e) => setForm((p) => (p ? { ...p, label: e.target.value } : p))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="m-unit">Unidade</Label>
                  <Input
                    id="m-unit"
                    value={form.unit}
                    placeholder="%, s, R$, /dia…"
                    disabled={!!form.key && !form.isCustom}
                    onChange={(e) => setForm((p) => (p ? { ...p, unit: e.target.value } : p))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-target">Meta</Label>
                  <Input
                    id="m-target"
                    value={form.target}
                    placeholder="ex.: ≥ 85%"
                    onChange={(e) => setForm((p) => (p ? { ...p, target: e.target.value } : p))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-desc">Descrição</Label>
                <Input
                  id="m-desc"
                  value={form.description}
                  placeholder="O que esta métrica mede?"
                  onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-rationale">Racional do veredito</Label>
                <Textarea
                  id="m-rationale"
                  rows={2}
                  value={form.rationale}
                  placeholder="Por que ela sustenta a decisão de promover/mentorar/aposentar?"
                  onChange={(e) => setForm((p) => (p ? { ...p, rationale: e.target.value } : p))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form?.label.trim() || createMetric.isPending || updateMetric.isPending}
            >
              {form?.key ? "Salvar" : "Criar métrica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir métrica</DialogTitle>
            <DialogDescription>
              “{confirmDelete?.label}” será removida do catálogo. Avaliações existentes não são
              alteradas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMetric.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
