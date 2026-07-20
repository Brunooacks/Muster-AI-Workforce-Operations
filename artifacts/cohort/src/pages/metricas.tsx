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
import { useLang, type Lang } from "@/lib/i18n";
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

const LAYER_ORDER = ["efficacy", "efficiency", "adoption", "governance", "value"] as const;

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  bcGov: "Governança",
  bcMetrics: "Métricas",
  eyebrow: "Governança",
  title: "Biblioteca de Métricas",
  subtitle: (n: number) =>
    `Catálogo profundo por vertical de negócio — ${n} métricas prontas, mais as suas tailor-made. Toda métrica declara camada, meta e o racional que sustenta o veredito.`,
  newMetric: "Nova métrica",
  errLoad: "Não foi possível carregar o catálogo",
  verticalEyebrow: "Vertical",
  layers: {
    efficacy: "Eficácia",
    efficiency: "Eficiência",
    adoption: "Adoção",
    governance: "Governança",
    value: "Valor",
  } as Record<string, string>,
  customPill: "Custom",
  editAria: "Editar métrica",
  deleteAria: "Excluir métrica",
  dialogEditTitle: "Editar métrica",
  dialogNewTitle: "Nova métrica tailor-made",
  dialogDescStandard: "Métrica do catálogo padrão: apenas meta, descrição e racional são editáveis.",
  dialogDescNew:
    "Defina a métrica no vocabulário do seu negócio. Ela fica disponível na admissão e nas avaliações.",
  labelVertical: "Vertical",
  labelLayer: "Camada",
  labelName: "Nome da métrica",
  phName: "ex.: Propostas geradas por semana",
  labelUnit: "Unidade",
  phUnit: "%, s, R$, /dia…",
  labelTarget: "Meta",
  phTarget: "ex.: ≥ 85%",
  labelDesc: "Descrição",
  phDesc: "O que esta métrica mede?",
  labelRationale: "Racional do veredito",
  phRationale: "Por que ela sustenta a decisão de promover/mentorar/aposentar?",
  cancel: "Cancelar",
  save: "Salvar",
  create: "Criar métrica",
  delTitle: "Excluir métrica",
  delDesc: (label: string) =>
    `“${label}” será removida do catálogo. Avaliações existentes não são alteradas.`,
  delBtn: "Excluir",
  toastUpdated: "Métrica atualizada",
  toastUpdateErr: "Erro ao atualizar métrica",
  toastCreated: "Métrica criada",
  toastCreateErr: "Erro ao criar métrica",
  toastDeleted: "Métrica excluída",
  toastDeleteErrTitle: "Não foi possível excluir",
  toastDeleteErrDesc: "Métricas do catálogo padrão não podem ser excluídas.",
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    bcGov: "Governance",
    bcMetrics: "Metrics",
    eyebrow: "Governance",
    title: "Metrics Library",
    subtitle: (n: number) =>
      `Deep catalog per business vertical — ${n} ready-made metrics, plus your tailor-made ones. Every metric declares layer, target and the rationale that supports the verdict.`,
    newMetric: "New metric",
    errLoad: "Could not load the catalog",
    verticalEyebrow: "Vertical",
    layers: {
      efficacy: "Efficacy",
      efficiency: "Efficiency",
      adoption: "Adoption",
      governance: "Governance",
      value: "Value",
    },
    customPill: "Custom",
    editAria: "Edit metric",
    deleteAria: "Delete metric",
    dialogEditTitle: "Edit metric",
    dialogNewTitle: "New tailor-made metric",
    dialogDescStandard: "Standard catalog metric: only target, description and rationale are editable.",
    dialogDescNew:
      "Define the metric in your business vocabulary. It becomes available at admission and in evaluations.",
    labelVertical: "Vertical",
    labelLayer: "Layer",
    labelName: "Metric name",
    phName: "e.g.: Proposals generated per week",
    labelUnit: "Unit",
    phUnit: "%, s, R$, /day…",
    labelTarget: "Target",
    phTarget: "e.g.: ≥ 85%",
    labelDesc: "Description",
    phDesc: "What does this metric measure?",
    labelRationale: "Verdict rationale",
    phRationale: "Why does it support the decision to promote/mentor/retire?",
    cancel: "Cancel",
    save: "Save",
    create: "Create metric",
    delTitle: "Delete metric",
    delDesc: (label: string) =>
      `“${label}” will be removed from the catalog. Existing evaluations are not changed.`,
    delBtn: "Delete",
    toastUpdated: "Metric updated",
    toastUpdateErr: "Error updating metric",
    toastCreated: "Metric created",
    toastCreateErr: "Error creating metric",
    toastDeleted: "Metric deleted",
    toastDeleteErrTitle: "Could not delete",
    toastDeleteErrDesc: "Standard catalog metrics cannot be deleted.",
  },
  es: {
    bcGov: "Gobernanza",
    bcMetrics: "Métricas",
    eyebrow: "Gobernanza",
    title: "Biblioteca de Métricas",
    subtitle: (n: number) =>
      `Catálogo profundo por vertical de negocio — ${n} métricas listas, más las tuyas tailor-made. Toda métrica declara capa, meta y el racional que sustenta el veredicto.`,
    newMetric: "Nueva métrica",
    errLoad: "No fue posible cargar el catálogo",
    verticalEyebrow: "Vertical",
    layers: {
      efficacy: "Eficacia",
      efficiency: "Eficiencia",
      adoption: "Adopción",
      governance: "Gobernanza",
      value: "Valor",
    },
    customPill: "Personalizada",
    editAria: "Editar métrica",
    deleteAria: "Eliminar métrica",
    dialogEditTitle: "Editar métrica",
    dialogNewTitle: "Nueva métrica tailor-made",
    dialogDescStandard: "Métrica del catálogo estándar: solo la meta, la descripción y el racional son editables.",
    dialogDescNew:
      "Define la métrica en el vocabulario de tu negocio. Queda disponible en la admisión y en las evaluaciones.",
    labelVertical: "Vertical",
    labelLayer: "Capa",
    labelName: "Nombre de la métrica",
    phName: "ej.: Propuestas generadas por semana",
    labelUnit: "Unidad",
    phUnit: "%, s, R$, /día…",
    labelTarget: "Meta",
    phTarget: "ej.: ≥ 85%",
    labelDesc: "Descripción",
    phDesc: "¿Qué mide esta métrica?",
    labelRationale: "Racional del veredicto",
    phRationale: "¿Por qué sustenta la decisión de ascender/mentoría/retirar?",
    cancel: "Cancelar",
    save: "Guardar",
    create: "Crear métrica",
    delTitle: "Eliminar métrica",
    delDesc: (label: string) =>
      `“${label}” será eliminada del catálogo. Las evaluaciones existentes no se modifican.`,
    delBtn: "Eliminar",
    toastUpdated: "Métrica actualizada",
    toastUpdateErr: "Error al actualizar la métrica",
    toastCreated: "Métrica creada",
    toastCreateErr: "Error al crear la métrica",
    toastDeleted: "Métrica eliminada",
    toastDeleteErrTitle: "No fue posible eliminar",
    toastDeleteErrDesc: "Las métricas del catálogo estándar no pueden eliminarse.",
  },
};

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
  const { lang } = useLang();
  const t = L[lang];
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
            toast({ title: t.toastUpdated });
            setForm(null);
            invalidate();
          },
          onError: () => toast({ title: t.toastUpdateErr, variant: "destructive" }),
        },
      );
    } else {
      createMetric.mutate(
        { data: { ...common, vertical: form.vertical } },
        {
          onSuccess: () => {
            toast({ title: t.toastCreated });
            setForm(null);
            invalidate();
          },
          onError: () => toast({ title: t.toastCreateErr, variant: "destructive" }),
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
          toast({ title: t.toastDeleted });
          setConfirmDelete(null);
          invalidate();
        },
        onError: () =>
          toast({
            title: t.toastDeleteErrTitle,
            description: t.toastDeleteErrDesc,
            variant: "destructive",
          }),
      },
    );
  };

  const totalMetrics = verticals?.reduce((n, v) => n + v.metrics.length, 0) ?? 0;

  return (
    <AppLayout breadcrumbs={[{ label: t.bcGov }, { label: t.bcMetrics }]}>
      <div className="space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle(totalMetrics)}
          action={
            <Button onClick={() => setForm(EMPTY_FORM(current?.key ?? "negocios"))}>
              <Plus className="mr-2 h-4 w-4" />
              {t.newMetric}
            </Button>
          }
        />

        {isError ? (
          <ErrorState title={t.errLoad} onRetry={() => refetch()} />
        ) : isLoading || !verticals ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-2xl rounded-full" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Vertical selector */}
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>{t.verticalEyebrow}</Eyebrow>
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
                            {t.layers[layerKey]}
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
                                    {m.isCustom && <Pill tone="blue">{t.customPill}</Pill>}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                                    {m.target}
                                    {m.unit ? ` · ${m.unit}` : ""}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    type="button"
                                    aria-label={t.editAria}
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
                                      aria-label={t.deleteAria}
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
            <DialogTitle>{form?.key ? t.dialogEditTitle : t.dialogNewTitle}</DialogTitle>
            <DialogDescription>
              {form?.key && !form.isCustom ? t.dialogDescStandard : t.dialogDescNew}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t.labelVertical}</Label>
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
                  <Label>{t.labelLayer}</Label>
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
                          {t.layers[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-label">{t.labelName}</Label>
                <Input
                  id="m-label"
                  value={form.label}
                  placeholder={t.phName}
                  disabled={!!form.key && !form.isCustom}
                  onChange={(e) => setForm((p) => (p ? { ...p, label: e.target.value } : p))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="m-unit">{t.labelUnit}</Label>
                  <Input
                    id="m-unit"
                    value={form.unit}
                    placeholder={t.phUnit}
                    disabled={!!form.key && !form.isCustom}
                    onChange={(e) => setForm((p) => (p ? { ...p, unit: e.target.value } : p))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="m-target">{t.labelTarget}</Label>
                  <Input
                    id="m-target"
                    value={form.target}
                    placeholder={t.phTarget}
                    onChange={(e) => setForm((p) => (p ? { ...p, target: e.target.value } : p))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-desc">{t.labelDesc}</Label>
                <Input
                  id="m-desc"
                  value={form.description}
                  placeholder={t.phDesc}
                  onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-rationale">{t.labelRationale}</Label>
                <Textarea
                  id="m-rationale"
                  rows={2}
                  value={form.rationale}
                  placeholder={t.phRationale}
                  onChange={(e) => setForm((p) => (p ? { ...p, rationale: e.target.value } : p))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form?.label.trim() || createMetric.isPending || updateMetric.isPending}
            >
              {form?.key ? t.save : t.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.delTitle}</DialogTitle>
            <DialogDescription>
              {t.delDesc(confirmDelete?.label ?? "")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMetric.isPending}>
              {t.delBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
