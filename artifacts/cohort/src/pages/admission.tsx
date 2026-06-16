import { AppLayout } from "@/components/layout";
import {
  useCreateAgent,
  useAnalyzeAgentSource,
  type AgentDraft,
  type DraftMetricLayer,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRef, useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading, Eyebrow } from "@/components/cohort";

const formSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  role: z.string().min(2, "Papel é obrigatório"),
  platform: z.string().min(1, "Plataforma é obrigatória"),
  bio: z.string().min(10, "Forneça uma breve descrição"),
  businessOwner: z.string().optional(),
  technicalOwner: z.string().optional(),
  autonomyLevel: z.enum(["autonomous", "escalates", "restricted"]).default("escalates"),
});

const LAYER_ORDER: DraftMetricLayer[] = [
  "efficacy",
  "efficiency",
  "adoption",
  "governance",
  "value",
];
const LAYER_LABELS: Record<DraftMetricLayer, string> = {
  efficacy: "Eficácia",
  efficiency: "Eficiência",
  adoption: "Adoção",
  governance: "Governança",
  value: "Valor",
};

function clean(arr: string[]): string[] {
  return arr.map((s) => s.trim()).filter(Boolean);
}

export default function AdmissionPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createAgent = useCreateAgent();
  const analyze = useAnalyzeAgentSource();

  const [source, setSource] = useState("");
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      role: "",
      platform: "openai",
      bio: "",
      businessOwner: "",
      technicalOwner: "",
      autonomyLevel: "escalates",
    },
  });

  function patchDraft(patch: Partial<AgentDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateMetric(index: number, patch: Partial<AgentDraft["proposedMetrics"][number]>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const proposedMetrics = prev.proposedMetrics.map((m, i) =>
        i === index ? { ...m, ...patch } : m,
      );
      return { ...prev, proposedMetrics };
    });
  }

  function removeMetric(index: number) {
    setDraft((prev) =>
      prev
        ? { ...prev, proposedMetrics: prev.proposedMetrics.filter((_, i) => i !== index) }
        : prev,
    );
  }

  function addMetric(layer: DraftMetricLayer) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            proposedMetrics: [
              ...prev.proposedMetrics,
              { layer, label: "", unit: "%", target: "" },
            ],
          }
        : prev,
    );
  }

  function applyDraftToForm(d: AgentDraft) {
    if (d.name) form.setValue("name", d.name);
    if (d.role) form.setValue("role", d.role);
    if (d.bio) form.setValue("bio", d.bio);
    if (d.autonomyLevel) form.setValue("autonomyLevel", d.autonomyLevel);
  }

  function onAnalyze() {
    if (source.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Material insuficiente",
        description: "Cole o código e/ou as definições de skills do agente.",
      });
      return;
    }
    analyze.mutate(
      {
        data: {
          content: source,
          platform: form.getValues("platform") || undefined,
          nameHint: form.getValues("name") || undefined,
        },
      },
      {
        onSuccess: (d) => {
          setDraft(d);
          applyDraftToForm(d);
          toast({
            title: "Rascunho gerado",
            description: "Revise e edite a Carteira de Trabalho proposta antes de admitir.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Falha na análise",
            description: "Não foi possível analisar o material do agente. Tente novamente.",
          });
        },
      },
    );
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSource((prev) => (prev ? `${prev}\n\n${text}` : text));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    const data = {
      ...values,
      ...(draft
        ? {
            tagline: draft.tagline,
            shouldDo: clean(draft.shouldDo),
            shouldNotDo: clean(draft.shouldNotDo),
            autonomyNotes: draft.autonomyNotes,
            limits: clean(draft.limits),
            baseline: draft.businessCase.baseline,
            targetPayback: draft.businessCase.targetPayback,
            businessCaseDescription: draft.businessCase.description,
            proposedMetrics: draft.proposedMetrics
              .filter((m) => m.label.trim())
              .map((m) => ({
                layer: m.layer,
                label: m.label.trim(),
                unit: m.unit.trim() || "%",
                target: m.target.trim(),
                rationale: m.rationale,
              })),
          }
        : {}),
    };

    createAgent.mutate(
      { data },
      {
        onSuccess: (agent) => {
          toast({
            title: "Admissão concluída",
            description: "Carteira de Trabalho gerada com sucesso.",
          });
          setLocation(`/agentes/${agent.agent.id}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erro na admissão",
            description: "Ocorreu um erro ao registrar o agente.",
          });
        },
      },
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Workspace" }, { label: "Admissão" }]}>
      <div className="mx-auto max-w-2xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Workspace"
          title="Cadastrar agente"
          subtitle="Gere a Carteira de Trabalho para um novo agente ingressar na frota."
        />

        <Card>
          <div className="border-b border-card-border px-6 py-4">
            <Eyebrow>Discovery por código e skills</Eyebrow>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Cole o código e as definições de skills do agente. A IA propõe uma Carteira de Trabalho
              e métricas editáveis.
            </p>
          </div>
          <CardContent className="space-y-4 pt-6">
            <Textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Cole aqui o código, prompts de sistema e/ou definições de skills do agente..."
              className="min-h-[160px] font-mono text-xs"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.toml"
              className="hidden"
              onChange={onUpload}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Enviar arquivo
              </Button>
              <Button type="button" onClick={onAnalyze} disabled={analyze.isPending}>
                {analyze.isPending ? "Analisando..." : "Analisar com IA"}
              </Button>
            </div>

            {draft && (
              <div className="space-y-5 rounded-md border border-card-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Eyebrow>Rascunho proposto</Eyebrow>
                    {draft.summary && (
                      <p className="mt-1 text-sm text-muted-foreground">{draft.summary}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    confiança {Math.round(draft.confidence)}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <FormLabel>Tagline</FormLabel>
                  <Input
                    value={draft.tagline}
                    onChange={(e) => patchDraft({ tagline: e.target.value })}
                    placeholder="Frase curta de posicionamento"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FormLabel>Deve fazer (um por linha)</FormLabel>
                    <Textarea
                      value={draft.shouldDo.join("\n")}
                      onChange={(e) => patchDraft({ shouldDo: e.target.value.split("\n") })}
                      className="min-h-[110px] text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FormLabel>Não deve fazer (um por linha)</FormLabel>
                    <Textarea
                      value={draft.shouldNotDo.join("\n")}
                      onChange={(e) => patchDraft({ shouldNotDo: e.target.value.split("\n") })}
                      className="min-h-[110px] text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FormLabel>Limites operacionais (um por linha)</FormLabel>
                  <Textarea
                    value={draft.limits.join("\n")}
                    onChange={(e) => patchDraft({ limits: e.target.value.split("\n") })}
                    className="min-h-[80px] text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <FormLabel>Notas de autonomia</FormLabel>
                  <Textarea
                    value={draft.autonomyNotes ?? ""}
                    onChange={(e) => patchDraft({ autonomyNotes: e.target.value })}
                    className="min-h-[60px] text-sm"
                  />
                </div>

                <div className="space-y-3 border-t border-card-border pt-4">
                  <Eyebrow>Caso de negócio</Eyebrow>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <FormLabel>Linha de base</FormLabel>
                      <Input
                        value={draft.businessCase.baseline}
                        onChange={(e) =>
                          patchDraft({
                            businessCase: { ...draft.businessCase, baseline: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FormLabel>Payback alvo</FormLabel>
                      <Input
                        value={draft.businessCase.targetPayback}
                        onChange={(e) =>
                          patchDraft({
                            businessCase: { ...draft.businessCase, targetPayback: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <FormLabel>Descrição</FormLabel>
                    <Textarea
                      value={draft.businessCase.description}
                      onChange={(e) =>
                        patchDraft({
                          businessCase: { ...draft.businessCase, description: e.target.value },
                        })
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-card-border pt-4">
                  <Eyebrow>Métricas propostas (5 camadas)</Eyebrow>
                  {LAYER_ORDER.map((layer) => {
                    const rows = draft.proposedMetrics
                      .map((m, i) => ({ m, i }))
                      .filter((x) => x.m.layer === layer);
                    return (
                      <div key={layer} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                            {LAYER_LABELS[layer]}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addMetric(layer)}
                          >
                            + Adicionar
                          </Button>
                        </div>
                        {rows.length === 0 && (
                          <p className="text-xs text-muted-foreground">Nenhuma métrica nesta camada.</p>
                        )}
                        {rows.map(({ m, i }) => (
                          <div key={i} className="grid grid-cols-[1fr_5rem_6rem_auto] gap-2">
                            <Input
                              value={m.label}
                              onChange={(e) => updateMetric(i, { label: e.target.value })}
                              placeholder="Rótulo"
                              className="text-sm"
                            />
                            <Input
                              value={m.unit}
                              onChange={(e) => updateMetric(i, { unit: e.target.value })}
                              placeholder="Unid."
                              className="text-sm"
                            />
                            <Input
                              value={m.target}
                              onChange={(e) => updateMetric(i, { target: e.target.value })}
                              placeholder="Meta"
                              className="text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMetric(i)}
                            >
                              Remover
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="border-b border-card-border px-6 py-4">
            <Eyebrow>Identidade básica</Eyebrow>
            <p className="mt-0.5 text-sm text-muted-foreground">Informações principais do agente</p>
          </div>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Agente</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: SupportBot v2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Papel Funcional</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: L1 Customer Support" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plataforma Base</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a plataforma" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI Assistants</SelectItem>
                            <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                            <SelectItem value="langchain">LangChain Custom</SelectItem>
                            <SelectItem value="flowise">Flowise</SelectItem>
                            <SelectItem value="custom">Custom API</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autonomyLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nível de Autonomia</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o nível" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="autonomous">Totalmente Autônomo (Pode agir)</SelectItem>
                            <SelectItem value="escalates">Escalador (Pede ajuda)</SelectItem>
                            <SelectItem value="restricted">Restrito (Apenas rascunho)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (Bio)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o propósito deste agente e seu escopo de atuação..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <FormField
                    control={form.control}
                    name="businessOwner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dono de Negócio</FormLabel>
                        <FormControl>
                          <Input placeholder="E-mail ou nome" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="technicalOwner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dono Técnico</FormLabel>
                        <FormControl>
                          <Input placeholder="E-mail ou nome" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-6">
                  <Button type="submit" disabled={createAgent.isPending}>
                    {createAgent.isPending ? "Admitindo..." : "Gerar Carteira de Trabalho"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
