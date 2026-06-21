import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/layout";
import {
  useCreateAgent,
  useAnalyzeAgentSource,
  useFetchAgentSource,
  useListConnectors,
  type AgentDraft,
  type AgentInput,
  type DraftMetric,
  type DraftMetricLayer,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PageHeading, Eyebrow, Pill } from "@/components/cohort";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const STEPS = [
  "Identidade",
  "Job Description",
  "Responsabilidade",
  "Autonomia",
  "Origem",
  "Conectar",
  "Probation",
] as const;

const AUTONOMY_OPTIONS: { value: AgentInput["autonomyLevel"]; label: string; desc: string }[] = [
  { value: "autonomous", label: "Autônoma", desc: "Decide e age sem aprovação humana" },
  { value: "escalates", label: "Escala", desc: "Age, mas escala casos sensíveis" },
  { value: "restricted", label: "Restrita", desc: "Só age com aprovação humana" },
];

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

const MAX_CONTENT_LENGTH = 100_000;

interface WizardData {
  name: string;
  tagline: string;
  role: string;
  platform: string;
  bio: string;
  shouldDo: string;
  shouldNotDo: string;
  businessOwner: string;
  technicalOwner: string;
  governanceSponsor: string;
  changeApprover: string;
  autonomyLevel: NonNullable<AgentInput["autonomyLevel"]>;
  autonomyNotes: string;
  limits: string;
  businessCaseDescription: string;
  baseline: string;
  targetPayback: string;
  dataSource: string;
  probationWeeks: string;
}

const INITIAL: WizardData = {
  name: "",
  tagline: "",
  role: "",
  platform: "openai-assistants",
  bio: "",
  shouldDo: "",
  shouldNotDo: "",
  businessOwner: "",
  technicalOwner: "",
  governanceSponsor: "",
  changeApprover: "",
  autonomyLevel: "escalates",
  autonomyNotes: "",
  limits: "",
  businessCaseDescription: "",
  baseline: "",
  targetPayback: "",
  dataSource: "",
  probationWeeks: "4",
};

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function StepField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A single file pulled in via the import-from-URL flow, kept selectable so the
// user can trim noise before spending an AI analysis on it.
interface ImportedFile {
  id: string;
  path: string;
  bytes: number;
  content: string;
  sourceType: "git" | "url";
  selected: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// The server concatenates git files as `===== <path> =====\n<body>` chunks
// joined by blank lines (see fetch-source.ts). Split that back into per-file
// bodies so each one can be reviewed and toggled independently. A single URL
// import has no markers and maps to one file.
function splitImportedFiles(
  content: string,
  files: { path: string; bytes: number }[],
  sourceType: "git" | "url",
): ImportedFile[] {
  const base = `${sourceType}-${Date.now()}`;
  if (sourceType === "url" || files.length <= 1) {
    return files.map((f, i) => ({
      id: `${base}-${i}`,
      path: f.path,
      bytes: f.bytes,
      content,
      sourceType,
      selected: true,
    }));
  }
  const parts = content.split(/^===== (.+?) =====$/m);
  const byPath = new Map<string, string>();
  for (let i = 1; i < parts.length; i += 2) {
    const path = parts[i]!.trim();
    const body = (parts[i + 1] ?? "").replace(/^\n/, "").replace(/\n+$/, "");
    byPath.set(path, body);
  }
  return files.map((f, i) => ({
    id: `${base}-${i}`,
    path: f.path,
    bytes: f.bytes,
    content: byPath.get(f.path) ?? "",
    sourceType,
    selected: true,
  }));
}

// Re-serialize selected imported files into the same chunk format the AI sees.
function serializeImportedFiles(files: ImportedFile[]): string {
  return files
    .filter((f) => f.selected)
    .map((f) =>
      f.sourceType === "git" ? `===== ${f.path} =====\n${f.content}` : f.content,
    )
    .join("\n\n");
}

export default function AdmissionPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createAgent = useCreateAgent();
  const analyze = useAnalyzeAgentSource();
  const fetchSource = useFetchAgentSource();
  const { data: connectors } = useListConnectors();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [metrics, setMetrics] = useState<DraftMetric[] | null>(null);

  // AI assist (optional)
  const [aiOpen, setAiOpen] = useState(false);
  const [source, setSource] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [importTruncated, setImportTruncated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The text actually sent to the AI: manually pasted source plus the selected
  // imported files. Imported content is kept out of the textarea so the file
  // list stays the source of truth for what gets analyzed.
  const importedSource = useMemo(
    () => serializeImportedFiles(importedFiles),
    [importedFiles],
  );
  const effectiveSource = useMemo(
    () => [source.trim(), importedSource].filter(Boolean).join("\n\n"),
    [source, importedSource],
  );
  const selectedImportedCount = importedFiles.filter((f) => f.selected).length;

  const overLimit = effectiveSource.length > MAX_CONTENT_LENGTH;

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const ownersComplete =
    data.businessOwner.trim() && data.technicalOwner.trim() && data.governanceSponsor.trim();

  const canAdvance = (() => {
    if (step === 0) return data.name.trim().length >= 2 && data.role.trim().length >= 2;
    if (step === 2) return Boolean(ownersComplete);
    return true;
  })();

  function applyDraft(d: AgentDraft) {
    setData((prev) => ({
      ...prev,
      name: d.name || prev.name,
      tagline: d.tagline || prev.tagline,
      role: d.role || prev.role,
      bio: d.bio || prev.bio,
      shouldDo: d.shouldDo?.length ? d.shouldDo.join("\n") : prev.shouldDo,
      shouldNotDo: d.shouldNotDo?.length ? d.shouldNotDo.join("\n") : prev.shouldNotDo,
      autonomyLevel: d.autonomyLevel ?? prev.autonomyLevel,
      autonomyNotes: d.autonomyNotes || prev.autonomyNotes,
      limits: d.limits?.length ? d.limits.join("\n") : prev.limits,
      businessCaseDescription: d.businessCase?.description || prev.businessCaseDescription,
      baseline: d.businessCase?.baseline || prev.baseline,
      targetPayback: d.businessCase?.targetPayback || prev.targetPayback,
    }));
    setMetrics(
      d.proposedMetrics
        ?.filter((m) => m.label.trim())
        .map((m) => ({
          layer: m.layer,
          label: m.label.trim(),
          unit: m.unit?.trim() || "%",
          target: m.target?.trim() ?? "",
          rationale: m.rationale,
        })) ?? null,
    );
    setAiOpen(false);
    toast({
      title: "Rascunho aplicado",
      description: "Os campos do cadastro foram preenchidos. Revise cada passo antes de admitir.",
    });
  }

  function onImportUrl() {
    const url = importUrl.trim();
    if (!url) {
      toast({
        variant: "destructive",
        title: "Informe um endereço",
        description: "Cole a URL de um repositório Git ou de um arquivo público.",
      });
      return;
    }
    fetchSource.mutate(
      { data: { url } },
      {
        onSuccess: (res) => {
          const parsed = splitImportedFiles(
            res.content,
            res.files,
            res.sourceType,
          );
          setImportedFiles((prev) => [...prev, ...parsed]);
          setImportTruncated((prev) => prev || res.truncated);
          setImportUrl("");
          toast({
            title: "Material importado",
            description: `${res.files.length} arquivo(s) carregado(s)${
              res.truncated ? " (conteúdo truncado pelo limite)" : ""
            }. Revise a lista e clique em Analisar com IA.`,
          });
        },
        onError: (err) => {
          const status = (err as { status?: number } | null)?.status;
          toast({
            variant: "destructive",
            title: "Falha na importação",
            description:
              status === 429
                ? "Limite de requisições atingido. Tente novamente em alguns minutos."
                : status === 403
                  ? "Sua conta GitHub não tem acesso a este repositório. Conecte ou reconecte sua conta GitHub e verifique as permissões."
                  : status === 404
                    ? "Repositório ou endereço não encontrado. Se for um repositório privado, conecte sua conta GitHub para importá-lo."
                    : status === 422
                      ? "Nenhum conteúdo relevante encontrado no endereço."
                      : "Não foi possível importar o material desse endereço.",
          });
        },
      },
    );
  }

  function onAnalyze() {
    if (effectiveSource.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Material insuficiente",
        description: "Cole o código e/ou as definições de skills do agente.",
      });
      return;
    }
    if (overLimit) {
      toast({
        variant: "destructive",
        title: "Conteúdo muito grande",
        description: `Reduza para até ${MAX_CONTENT_LENGTH.toLocaleString("pt-BR")} caracteres.`,
      });
      return;
    }
    analyze.mutate(
      {
        data: {
          content: effectiveSource,
          platform: data.platform || undefined,
          nameHint: data.name || undefined,
        },
      },
      { onSuccess: applyDraft },
    );
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSource((prev) => (prev ? `${prev}\n\n${text}` : text));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleImportedFile(id: string) {
    setImportedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)),
    );
  }

  function removeImportedFile(id: string) {
    setImportedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function setAllImportedSelected(selected: boolean) {
    setImportedFiles((prev) => prev.map((f) => ({ ...f, selected })));
  }

  function clearImportedFiles() {
    setImportedFiles([]);
    setImportTruncated(false);
  }

  function next() {
    if (!canAdvance) {
      if (step === 0) {
        toast({
          variant: "destructive",
          title: "Identidade incompleta",
          description: "Informe ao menos nome e papel da agente.",
        });
      } else if (step === 2) {
        toast({
          variant: "destructive",
          title: "Cadeia de donos incompleta",
          description: "Defina dono de negócio, dono técnico e sponsor de governança.",
        });
      }
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    if (!ownersComplete) {
      setStep(2);
      toast({
        variant: "destructive",
        title: "Cadeia de donos incompleta",
        description: "Sem os três donos, a agente não pode ir para produção.",
      });
      return;
    }

    const autonomyNotes = [
      data.autonomyNotes.trim(),
      data.changeApprover.trim() ? `Aprovador de mudanças: ${data.changeApprover.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const businessCaseDescription = [
      data.businessCaseDescription.trim(),
      data.dataSource.trim() ? `Fonte de dados: ${data.dataSource.trim()}` : "",
      data.probationWeeks.trim()
        ? `Período de probation: ${data.probationWeeks.trim()} semanas`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload: AgentInput = {
      name: data.name.trim(),
      role: data.role.trim(),
      platform: data.platform,
      bio: data.bio.trim() || data.tagline.trim() || `${data.role.trim()} na frota.`,
      tagline: data.tagline.trim() || undefined,
      shouldDo: toLines(data.shouldDo),
      shouldNotDo: toLines(data.shouldNotDo),
      autonomyLevel: data.autonomyLevel,
      autonomyNotes: autonomyNotes || undefined,
      limits: toLines(data.limits),
      businessOwner: data.businessOwner.trim() || undefined,
      technicalOwner: data.technicalOwner.trim() || undefined,
      governanceSponsor: data.governanceSponsor.trim() || undefined,
      baseline: data.baseline.trim() || undefined,
      targetPayback: data.targetPayback.trim() || undefined,
      businessCaseDescription: businessCaseDescription || undefined,
      ...(metrics && metrics.length > 0 ? { proposedMetrics: metrics } : {}),
    };

    createAgent.mutate(
      { data: payload },
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
            description: "Ocorreu um erro ao registrar a agente.",
          });
        },
      },
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Conta" }, { label: "Admissão" }]}>
      <div className="mx-auto max-w-3xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Conta · Admissão"
          title="Cadastrar nova agente"
          subtitle="A Carteira de Trabalho começa antes do agente existir. Cada campo evita uma falha futura."
        />

        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                step === i
                  ? "bg-primary text-primary-foreground"
                  : step > i
                    ? "text-chart-1 hover:bg-secondary/60"
                    : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              {step > i ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="font-mono">{(i + 1).toString().padStart(2, "0")}</span>
              )}
              {label}
            </button>
          ))}
        </div>

        <Card className="p-6">
          {/* STEP 1 — Identidade */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">Identidade</h2>
                <p className="text-sm text-muted-foreground">Quem é a agente e onde ela opera.</p>
              </div>

              {/* AI assist */}
              <div className="rounded-xl border border-card-border bg-secondary/30">
                <button
                  type="button"
                  onClick={() => setAiOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-chart-2" strokeWidth={1.75} />
                    Pré-preencher com IA (opcional)
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      aiOpen && "rotate-180",
                    )}
                  />
                </button>
                {aiOpen && (
                  <div className="space-y-3 border-t border-card-border px-4 py-4">
                    <p className="text-xs text-muted-foreground">
                      Cole o código, prompts e definições de skills da agente. A IA propõe persona,
                      Carteira de Trabalho e métricas — editáveis nos próximos passos.
                    </p>
                    <Textarea
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Cole aqui o código, prompts de sistema e/ou skills da agente…"
                      className="min-h-[120px] font-mono text-xs"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.toml"
                      className="hidden"
                      onChange={onUpload}
                    />
                    <div className="space-y-1.5 rounded-md border border-card-border bg-muted/30 p-3">
                      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Importar de um repositório Git ou URL
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (!fetchSource.isPending) onImportUrl();
                            }
                          }}
                          placeholder="https://github.com/org/repo ou URL de um arquivo público"
                          className="min-w-[16rem] flex-1 font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onImportUrl}
                          disabled={fetchSource.isPending}
                        >
                          {fetchSource.isPending ? "Importando..." : "Importar"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Buscamos os arquivos de código e skills relevantes (limites de tamanho e tipo
                        aplicados) e os listamos para você revisar antes de analisar. Para
                        repositórios privados, conecte sua conta GitHub nas integrações do Replit.
                      </p>
                    </div>

                    {importedFiles.length > 0 && (
                      <div className="space-y-3 rounded-md border border-card-border bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                            Arquivos importados ({selectedImportedCount}/
                            {importedFiles.length} selecionados)
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllImportedSelected(true)}
                              disabled={selectedImportedCount === importedFiles.length}
                            >
                              Selecionar todos
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllImportedSelected(false)}
                              disabled={selectedImportedCount === 0}
                            >
                              Limpar seleção
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearImportedFiles}
                            >
                              Remover tudo
                            </Button>
                          </div>
                        </div>
                        {importTruncated && (
                          <p className="text-xs text-destructive">
                            Conteúdo truncado pelo limite de tamanho — alguns arquivos
                            podem não ter sido incluídos por completo.
                          </p>
                        )}
                        <ul className="max-h-64 space-y-1 overflow-y-auto">
                          {importedFiles.map((file) => (
                            <li
                              key={file.id}
                              className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-muted/60"
                            >
                              <Checkbox
                                id={`imported-${file.id}`}
                                checked={file.selected}
                                onCheckedChange={() => toggleImportedFile(file.id)}
                              />
                              <label
                                htmlFor={`imported-${file.id}`}
                                className="min-w-0 flex-1 cursor-pointer truncate font-mono text-xs"
                                title={file.path}
                              >
                                {file.path}
                              </label>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                {formatBytes(file.bytes)}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => removeImportedFile(file.id)}
                              >
                                Remover
                              </Button>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Apenas os arquivos selecionados serão enviados para a análise
                          com IA.
                        </p>
                      </div>
                    )}
                    <p
                      className={`text-right font-mono text-xs ${
                        overLimit ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {effectiveSource.length.toLocaleString("pt-BR")} /{" "}
                      {MAX_CONTENT_LENGTH.toLocaleString("pt-BR")} caracteres
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Enviar arquivo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={onAnalyze}
                        disabled={analyze.isPending || overLimit}
                      >
                        {analyze.isPending ? "Analisando…" : "Analisar com IA"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <StepField label="Nome">
                  <Input
                    value={data.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Ex.: Júlia"
                  />
                </StepField>
                <StepField label="Papel">
                  <Input
                    value={data.role}
                    onChange={(e) => set("role", e.target.value)}
                    placeholder="Ex.: Pré-qualificação Inbound"
                  />
                </StepField>
              </div>
              <StepField label="Tagline" hint="Uma frase que resume a missão da agente.">
                <Input
                  value={data.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  placeholder="Ex.: Qualifica leads antes do time comercial"
                />
              </StepField>
              <StepField label="Plataforma">
                <Select value={data.platform} onValueChange={(v) => set("platform", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StepField>
            </div>
          )}

          {/* STEP 2 — Job Description */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">Job Description</h2>
                <p className="text-sm text-muted-foreground">O que a agente faz — e o que não faz.</p>
              </div>
              <StepField label="Descrição" hint="O que a agente entrega no dia a dia.">
                <Textarea
                  value={data.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder="Descreva a função principal da agente…"
                  className="min-h-[100px]"
                />
              </StepField>
              <StepField label="Deve fazer" hint="Uma responsabilidade por linha.">
                <Textarea
                  value={data.shouldDo}
                  onChange={(e) => set("shouldDo", e.target.value)}
                  placeholder={"Responder em até 2 minutos\nQualificar pelo orçamento\n…"}
                  className="min-h-[100px]"
                />
              </StepField>
              <StepField label="Não deve fazer" hint="Uma restrição por linha.">
                <Textarea
                  value={data.shouldNotDo}
                  onChange={(e) => set("shouldNotDo", e.target.value)}
                  placeholder={"Prometer descontos\nFalar de concorrentes\n…"}
                  className="min-h-[100px]"
                />
              </StepField>
            </div>
          )}

          {/* STEP 3 — Responsabilidade */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">Responsabilidade</h2>
                <p className="text-sm text-muted-foreground">
                  A cadeia de donos. Sem os três nomes, a agente não vai para produção.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <StepField label="Dono de negócio">
                  <Input
                    value={data.businessOwner}
                    onChange={(e) => set("businessOwner", e.target.value)}
                    placeholder="Responsável pelo resultado"
                  />
                </StepField>
                <StepField label="Dono técnico">
                  <Input
                    value={data.technicalOwner}
                    onChange={(e) => set("technicalOwner", e.target.value)}
                    placeholder="Responsável pela operação"
                  />
                </StepField>
                <StepField label="Sponsor de governança">
                  <Input
                    value={data.governanceSponsor}
                    onChange={(e) => set("governanceSponsor", e.target.value)}
                    placeholder="Patrocinador executivo"
                  />
                </StepField>
                <StepField label="Aprovador de mudanças" hint="Opcional.">
                  <Input
                    value={data.changeApprover}
                    onChange={(e) => set("changeApprover", e.target.value)}
                    placeholder="Quem aprova alterações"
                  />
                </StepField>
              </div>
              {!ownersComplete && (
                <Pill tone="ochre">Preencha os três donos para avançar</Pill>
              )}
            </div>
          )}

          {/* STEP 4 — Autonomia */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">Autonomia</h2>
                <p className="text-sm text-muted-foreground">
                  Até onde a agente pode ir sozinha — e onde precisa de gente.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {AUTONOMY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("autonomyLevel", opt.value!)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      data.autonomyLevel === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-card-border hover:border-foreground/30",
                    )}
                  >
                    <div className="text-sm font-medium text-foreground">{opt.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <StepField label="Notas de autonomia" hint="Quando ela decide sozinha e quando escala.">
                <Textarea
                  value={data.autonomyNotes}
                  onChange={(e) => set("autonomyNotes", e.target.value)}
                  placeholder="Ex.: Decide sozinha até R$ 500; acima disso, escala ao dono de negócio."
                  className="min-h-[90px]"
                />
              </StepField>
              <StepField label="Limites rígidos" hint="Uma proibição por linha.">
                <Textarea
                  value={data.limits}
                  onChange={(e) => set("limits", e.target.value)}
                  placeholder={"Nunca alterar contratos\nNunca acessar dados financeiros\n…"}
                  className="min-h-[90px]"
                />
              </StepField>
            </div>
          )}

          {/* STEP 5 — Origem */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">Origem</h2>
                <p className="text-sm text-muted-foreground">
                  O business case: por que esta agente existe e o que ela precisa provar.
                </p>
              </div>
              <StepField label="Business case" hint="O problema que justifica a agente.">
                <Textarea
                  value={data.businessCaseDescription}
                  onChange={(e) => set("businessCaseDescription", e.target.value)}
                  placeholder="Ex.: Reduzir o tempo de primeira resposta e liberar o time comercial."
                  className="min-h-[90px]"
                />
              </StepField>
              <div className="grid gap-5 sm:grid-cols-2">
                <StepField label="Baseline atual" hint="O ponto de partida sem a agente.">
                  <Input
                    value={data.baseline}
                    onChange={(e) => set("baseline", e.target.value)}
                    placeholder="Ex.: 6h de tempo médio de resposta"
                  />
                </StepField>
                <StepField label="Payback alvo" hint="Quando o investimento se paga.">
                  <Input
                    value={data.targetPayback}
                    onChange={(e) => set("targetPayback", e.target.value)}
                    placeholder="Ex.: 3 meses"
                  />
                </StepField>
              </div>
            </div>
          )}

          {/* STEP 6 — Conectar */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">Conectar</h2>
                <p className="text-sm text-muted-foreground">
                  De onde virão os sinais de desempenho da agente.
                </p>
              </div>
              <StepField label="Fonte de dados" hint="Vincule um conector para alimentar as métricas.">
                <Select
                  value={data.dataSource || undefined}
                  onValueChange={(v) => set("dataSource", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um conector" />
                  </SelectTrigger>
                  <SelectContent>
                    {(connectors ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                        {c.status === "connected" ? " · conectado" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StepField>
              <p className="text-xs text-muted-foreground">
                Você pode gerenciar conectores depois em Conta · Conectores.
              </p>
            </div>
          )}

          {/* STEP 7 — Probation */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-xl font-medium text-foreground">Probation</h2>
                <p className="text-sm text-muted-foreground">
                  A agente entra em período de observação antes de ser promovida.
                </p>
              </div>
              <StepField label="Duração do probation (semanas)">
                <Select value={data.probationWeeks} onValueChange={(v) => set("probationWeeks", v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["2", "4", "6", "8"].map((w) => (
                      <SelectItem key={w} value={w}>
                        {w} semanas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StepField>

              {/* Resumo */}
              <div className="rounded-xl border border-card-border bg-secondary/30 p-4">
                <Eyebrow>Resumo</Eyebrow>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Agente</dt>
                    <dd className="font-medium text-foreground">
                      {data.name || "—"} · {data.role || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Plataforma</dt>
                    <dd className="font-medium text-foreground">
                      {PLATFORM_LABELS[data.platform] ?? data.platform}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Donos</dt>
                    <dd className="font-medium text-foreground">
                      {[data.businessOwner, data.technicalOwner, data.governanceSponsor]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Autonomia</dt>
                    <dd className="font-medium text-foreground">
                      {AUTONOMY_OPTIONS.find((o) => o.value === data.autonomyLevel)?.label}
                    </dd>
                  </div>
                </dl>
                {metrics && metrics.length > 0 && (
                  <div className="mt-3">
                    <dt className="text-xs text-muted-foreground">Métricas propostas</dt>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {LAYER_ORDER.filter((l) => metrics.some((m) => m.layer === l)).map((l) => (
                        <Pill key={l} tone="blue">
                          {LAYER_LABELS[l]}
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between border-t border-card-border pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (step === 0 ? setLocation("/agentes") : setStep((s) => s - 1))}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {step === 0 ? "Cancelar" : "Voltar"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={!canAdvance}>
                Avançar <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={createAgent.isPending}>
                {createAgent.isPending ? "Admitindo…" : "Admitir na frota"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
