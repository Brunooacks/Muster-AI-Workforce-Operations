import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Coins,
  Download,
  Gauge,
  Loader2,
  Presentation,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import {
  getGetExecutiveReportQueryKey,
  getListExecutiveReportsQueryKey,
  useGenerateExecutiveReport,
  useGetExecutiveReport,
  useListExecutiveReports,
  type ExecutiveMetricComparison,
  type ExecutiveReport,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type TemplateId = "board-brief" | "performance-review" | "risk-governance";
type NarrativeMode = "deterministic" | "ai-assisted";

const templates: Array<{
  id: TemplateId;
  label: string;
  audience: string;
  description: string;
  sections: string[];
}> = [
  { id: "board-brief", label: "Board Brief", audience: "Conselho e C-level", description: "Decisões, risco, evolução e próximos compromissos.", sections: ["outcomes", "risk-governance", "decisions", "outlook"] },
  { id: "performance-review", label: "Performance Review", audience: "Gestores e áreas", description: "Propósito, qualidade, eficiência, adoção e evolução.", sections: ["outcomes", "workforce", "decisions"] },
  { id: "risk-governance", label: "Risk & Governance", audience: "Risco e auditoria", description: "Evidências, guardrails, confiança e decisões pendentes.", sections: ["risk-governance", "decisions", "outlook"] },
];

const layerLabels: Record<string, string> = {
  efficacy: "Eficácia",
  efficiency: "Eficiência",
  adoption: "Adoção",
  governance: "Governança",
  value: "Valor / propósito",
};

const reportingChain = [
  { label: "Dados observados", description: "Eventos, custos, avaliações e alertas", icon: Activity },
  { label: "Fatos calculados", description: "KPIs, cobertura, comparação e qualidade", icon: Gauge },
  { label: "Leitura assistida", description: "IA interpreta sem alterar os números", icon: Bot },
  { label: "Decisão responsável", description: "Gestor revisa, publica e acompanha", icon: ShieldCheck },
];

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year!, month! - 1, 1));
}

function formatMetric(metric: ExecutiveMetricComparison | undefined, fallback = "—"): string {
  if (!metric || metric.current === null) return fallback;
  if (metric.unit === "%") return `${metric.current}%`;
  if (metric.unit === "ms") return metric.current >= 1_000 ? `${(metric.current / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s` : `${metric.current}ms`;
  if (metric.unit === "centavos") return (metric.current / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (metric.unit === "execuções") return metric.current.toLocaleString("pt-BR");
  return `${metric.current}`;
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)]", className)}>{children}</section>;
}

function Delta({ metric }: { metric: ExecutiveMetricComparison | undefined }) {
  if (!metric || metric.delta === null) return <span className="text-[9px] text-[var(--wo-muted)]">sem comparação</span>;
  const improved = metric.direction === "lower-is-better" ? metric.delta < 0 : metric.delta > 0;
  const Icon = metric.delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={cn("inline-flex items-center gap-1 text-[9px]", improved ? "text-[var(--wo-accent)]" : metric.delta === 0 ? "text-[var(--wo-muted)]" : "text-[var(--wo-danger)]")}><Icon className="h-3 w-3" />{metric.delta > 0 ? "+" : ""}{metric.delta} {metric.unit === "%" ? "pp" : metric.unit}</span>;
}

function MetricCard({ label, metric, icon: Icon, note }: { label: string; metric?: ExecutiveMetricComparison; icon: typeof Activity; note?: string }) {
  return <Panel className="p-4"><div className="flex items-center justify-between gap-2"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">{label}</span><Icon className="h-4 w-4 text-[var(--wo-primary)]" /></div><strong className="mt-3 block font-mono text-2xl font-medium text-[var(--wo-text)]">{formatMetric(metric)}</strong><div className="mt-2 flex items-center justify-between gap-2"><Delta metric={metric} />{note && <span className="text-[8px] text-[var(--wo-muted)]">{note}</span>}</div></Panel>;
}

function ReportEmpty({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return <Panel className="grid min-h-[420px] place-items-center p-8 text-center"><div className="max-w-lg"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Presentation className="h-6 w-6" /></span><h2 className="mt-5 text-xl font-medium text-[var(--wo-text)]">Transforme telemetria em memória executiva</h2><p className="mt-3 text-xs leading-6 text-[var(--wo-muted)]">Gere o primeiro snapshot mensal com comparação, qualidade dos dados, decisões e evidências. Métricas são calculadas; IA atua somente na narrativa.</p><button type="button" onClick={onGenerate} disabled={generating} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-4 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-60">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar relatório do mês</button></div></Panel>;
}

export function ExecutiveReportsScreen() {
  const listQuery = useListExecutiveReports({ limit: 12 });
  const generateReport = useGenerateExecutiveReport();
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [templateId, setTemplateId] = useState<TemplateId>("board-brief");
  const [narrativeMode, setNarrativeMode] = useState<NarrativeMode>("deterministic");
  const [generationMessage, setGenerationMessage] = useState("");
  const reportQuery = useGetExecutiveReport(selectedPeriod, {
    query: { queryKey: getGetExecutiveReportQueryKey(selectedPeriod), retry: false },
  });

  useEffect(() => {
    const latest = listQuery.data?.reports[0];
    if (latest && !reportQuery.data && reportQuery.isError) setSelectedPeriod(latest.period);
  }, [listQuery.data, reportQuery.data, reportQuery.isError]);

  const selectedTemplate = templates.find((template) => template.id === templateId) ?? templates[0]!;
  const report = reportQuery.data;
  const visibleSections = useMemo(
    () => report?.sections.filter((section) => selectedTemplate.sections.includes(section.key)) ?? [],
    [report, selectedTemplate.sections],
  );

  function handleGenerate() {
    generateReport.mutate(
      { data: { period: selectedPeriod, narrativeMode, templateId } },
      {
        onSuccess: (created) => {
          setGenerationMessage(created.narrativeSource === "ai-assisted" ? "Snapshot criado com narrativa assistida por IA." : created.aiInsight === "unavailable" ? "Sem insight de IA; o texto determinístico foi preservado." : "Snapshot mensal criado com fatos determinísticos.");
          queryClient.setQueryData(getGetExecutiveReportQueryKey(created.period), created);
          queryClient.invalidateQueries({ queryKey: getListExecutiveReportsQueryKey() });
        },
        onError: (error) => setGenerationMessage(error instanceof Error ? error.message : "Não foi possível gerar o relatório."),
      },
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 print:p-0">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between print:hidden">
        <div><span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--wo-accent)]">Board & Decision Intelligence</span><h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[var(--wo-text)] sm:text-4xl">Uma linha executiva entre operação, risco e resultado.</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--wo-muted)]">Fechamentos mensais versionados mostram o que mudou, por que importa, quais limitações existem e quem responde pela próxima ação.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} disabled={!report} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card)] px-3 py-2.5 text-xs text-[var(--wo-text)] disabled:opacity-40"><Download className="h-4 w-4" /> Exportar / PDF</button><button type="button" onClick={handleGenerate} disabled={generateReport.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wo-accent)] px-3 py-2.5 text-xs font-medium text-[var(--wo-accent-ink)] disabled:opacity-60">{generateReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Gerar fechamento</button></div>
      </div>

      <Panel className="overflow-hidden print:hidden">
        <div className="grid gap-px bg-[var(--wo-line)] md:grid-cols-2 xl:grid-cols-4">
          {reportingChain.map((step, index) => {
            const Icon = step.icon;
            return <div key={step.label} className="bg-[var(--wo-card)] p-4"><div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--wo-primary-soft)] text-[var(--wo-primary)]"><Icon className="h-4 w-4" /></span><span className="font-mono text-[8px] text-[var(--wo-muted)]">0{index + 1}</span></div><strong className="mt-3 block text-xs font-medium text-[var(--wo-text)]">{step.label}</strong><span className="mt-1 block text-[9px] leading-relaxed text-[var(--wo-muted)]">{step.description}</span></div>;
          })}
        </div>
      </Panel>

      <Panel className="p-4 print:hidden">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto_auto] xl:items-end">
          <div><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Modelo do relatório</span><div className="mt-2 grid gap-2 md:grid-cols-3">{templates.map((template) => <button key={template.id} type="button" onClick={() => setTemplateId(template.id)} className={cn("rounded-xl border p-3 text-left transition", templateId === template.id ? "border-[var(--wo-primary)] bg-[var(--wo-primary-soft)]" : "border-[var(--wo-line)] bg-[var(--wo-card-2)] hover:border-[var(--wo-primary)]")}><strong className="block text-xs font-medium text-[var(--wo-text)]">{template.label}</strong><span className="mt-1 block text-[9px] text-[var(--wo-primary)]">{template.audience}</span><span className="mt-2 block text-[9px] leading-relaxed text-[var(--wo-muted)]">{template.description}</span></button>)}</div></div>
          <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Período</span><input type="month" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} className="mt-2 h-10 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)]" /></label>
          <label><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Narrativa</span><select value={narrativeMode} onChange={(event) => setNarrativeMode(event.target.value as NarrativeMode)} className="mt-2 h-10 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 text-xs text-[var(--wo-text)]"><option value="deterministic">Facts-first</option><option value="ai-assisted">IA assistida · guardrails</option></select></label>
        </div>
        {generationMessage && <div role="status" className="mt-3 rounded-xl bg-[var(--wo-primary-soft)] px-3 py-2 text-[10px] text-[var(--wo-primary)]">{generationMessage}</div>}
      </Panel>

      {reportQuery.isLoading ? <Panel className="grid min-h-[420px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--wo-primary)]" /></Panel> : !report ? <ReportEmpty generating={generateReport.isPending} onGenerate={handleGenerate} /> : <ExecutiveReportView report={report} sections={visibleSections} template={selectedTemplate.label} />}
    </div>
  );
}

function ExecutiveReportView({ report, sections, template }: { report: ExecutiveReport; sections: ExecutiveReport["sections"]; template: string }) {
  const qualityTone = report.quality.decisionReady ? "text-[var(--wo-accent)]" : "text-[var(--wo-warning)]";
  return <article className="space-y-4 print:text-black">
    <Panel className="overflow-hidden p-5 sm:p-6 print:border-0 print:bg-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><span className="text-[9px] uppercase tracking-[0.12em] text-[var(--wo-primary)]">{template} · versão {report.version}</span><h2 className="mt-2 font-serif text-3xl font-medium tracking-[-0.035em] text-[var(--wo-text)] print:text-black">{report.title}</h2><p className="mt-2 text-[10px] text-[var(--wo-muted)] print:text-gray-600">Gerado em {new Date(report.generatedAt).toLocaleString("pt-BR")} · comparação com {formatPeriod(report.previousPeriod)} · fonte {report.narrativeSource === "ai-assisted" ? `IA assistida · ${report.narrativeModel ?? "modelo configurado"}` : "regras determinísticas"}</p></div><div className="flex items-center gap-2"><span className={cn("inline-flex items-center gap-1.5 rounded-full bg-[var(--wo-card-2)] px-3 py-1.5 text-[9px]", qualityTone)}>{report.quality.decisionReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />} qualidade {report.quality.score}%</span></div></div>
      <div className="mt-6 border-l-2 border-[var(--wo-primary)] pl-4"><span className="text-[9px] uppercase tracking-[0.08em] text-[var(--wo-muted)]">Leitura executiva</span><p className="mt-2 max-w-5xl text-lg leading-relaxed text-[var(--wo-text)] print:text-black">{report.executiveSummary}</p></div>
    </Panel>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Score operacional" metric={report.metrics.operationalScore} icon={Gauge} /><MetricCard label="Taxa de sucesso" metric={report.metrics.successRate} icon={Target} /><MetricCard label="Execuções" metric={report.metrics.executionCount} icon={Activity} /><MetricCard label="Custo / execução" metric={report.metrics.costPerExecutionCents} icon={Coins} note="dimensão opcional" /></div>

    <div className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
      <Panel className="p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium text-[var(--wo-text)] print:text-black">Comparativo por dimensão</h3><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Mês atual versus anterior, preservando o significado de cada camada.</p></div><CalendarDays className="h-4 w-4 text-[var(--wo-primary)]" /></div><div className="mt-5 space-y-4">{Object.entries(report.layerComparison).map(([layer, metric]) => <div key={layer} className="grid grid-cols-[100px_1fr_42px] items-center gap-3"><span className="text-[10px] text-[var(--wo-muted)]">{layerLabels[layer] ?? layer}</span><div className="relative h-6 overflow-hidden rounded-lg bg-[var(--wo-card-2)]"><div className="absolute inset-y-0 left-0 rounded-lg bg-[var(--wo-line)]" style={{ width: `${metric.previous ?? 0}%` }} /><div className="absolute inset-y-1 left-0 rounded-md bg-[var(--wo-primary)]" style={{ width: `${metric.current ?? 0}%` }} /></div><strong className="text-right font-mono text-xs text-[var(--wo-text)] print:text-black">{metric.current ?? "—"}</strong></div>)}</div><div className="mt-4 flex gap-4 text-[8px] text-[var(--wo-muted)]"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[var(--wo-primary)]" /> atual</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[var(--wo-line)]" /> anterior</span></div></Panel>
      <Panel className="p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-medium text-[var(--wo-text)] print:text-black">Portfólio no período</h3><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Cobertura e decisões dos profissionais digitais.</p></div><Users className="h-4 w-4 text-[var(--wo-primary)]" /></div><div className="mt-5 grid grid-cols-2 gap-2">{[["Ativos", report.portfolio.activeAgents], ["Com execução", report.portfolio.agentsWithExecution], ["Novos", report.portfolio.newAgents], ["Alertas críticos", report.portfolio.criticalAlerts]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-[var(--wo-card-2)] p-3"><span className="text-[9px] text-[var(--wo-muted)]">{label as string}</span><strong className="mt-2 block font-mono text-xl text-[var(--wo-text)] print:text-black">{value as number}</strong></div>)}</div><div className="mt-4 rounded-xl border border-[var(--wo-line)] p-3"><div className="flex justify-between text-[9px] text-[var(--wo-muted)]"><span>Cobertura de dados</span><strong className="text-[var(--wo-text)] print:text-black">{report.quality.dataCoverage}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--wo-line)]"><div className="h-full rounded-full bg-[var(--wo-accent)]" style={{ width: `${report.quality.dataCoverage}%` }} /></div></div></Panel>
    </div>

    {report.insights.length > 0 && <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--wo-line)] px-4 py-3"><div><h3 className="text-sm font-medium text-[var(--wo-text)] print:text-black">Insights priorizados</h3><p className="mt-1 text-[10px] text-[var(--wo-muted)]">Cada leitura mantém confiança e referências de evidência.</p></div><Bot className="h-4 w-4 text-[var(--wo-primary)]" /></div><div className="grid gap-px bg-[var(--wo-line)] lg:grid-cols-2">{report.insights.map((insight) => <div key={insight.id} className="bg-[var(--wo-card)] p-4"><div className="flex items-start justify-between gap-3"><span className={cn("rounded-full px-2 py-1 text-[8px] uppercase tracking-[0.06em]", insight.severity === "positive" ? "bg-[color-mix(in_srgb,var(--wo-accent)_14%,transparent)] text-[var(--wo-accent)]" : insight.severity === "critical" || insight.severity === "high" ? "bg-[color-mix(in_srgb,var(--wo-danger)_14%,transparent)] text-[var(--wo-danger)]" : "bg-[color-mix(in_srgb,var(--wo-warning)_14%,transparent)] text-[var(--wo-warning)]")}>{insight.severity}</span><span className="font-mono text-[9px] text-[var(--wo-muted)]">{insight.confidence}% confiança</span></div><strong className="mt-3 block text-xs font-medium text-[var(--wo-text)] print:text-black">{insight.title}</strong><p className="mt-2 text-[10px] leading-relaxed text-[var(--wo-muted)]">{insight.narrative}</p><div className="mt-3 rounded-xl bg-[var(--wo-card-2)] p-3 text-[10px] leading-relaxed text-[var(--wo-text)] print:text-black"><strong>Recomendação:</strong> {insight.recommendation}</div><div className="mt-3 flex flex-wrap gap-1">{insight.evidenceRefs.slice(0, 3).map((reference) => <span key={reference} className="rounded bg-[var(--wo-card-2)] px-2 py-1 font-mono text-[7px] text-[var(--wo-muted)]">{reference}</span>)}</div></div>)}</div></Panel>}

    <div className="grid gap-3 lg:grid-cols-2">{sections.map((section) => <Panel key={section.key} className="p-4"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[var(--wo-primary)]" /><h3 className="text-sm font-medium text-[var(--wo-text)] print:text-black">{section.title}</h3></div><p className="mt-3 text-xs leading-relaxed text-[var(--wo-muted)]">{section.summary}</p><ul className="mt-4 space-y-2">{section.highlights.map((highlight) => <li key={highlight} className="flex gap-2 text-[10px] leading-relaxed text-[var(--wo-text)] print:text-black"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wo-accent)]" />{highlight}</li>)}</ul></Panel>)}</div>

    {!report.quality.decisionReady && <Panel className="border-[var(--wo-warning)] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--wo-warning)]" /><div><h3 className="text-xs font-medium text-[var(--wo-text)] print:text-black">Limitações para decisão</h3><ul className="mt-2 space-y-1 text-[10px] text-[var(--wo-muted)]">{report.quality.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul></div></div></Panel>}
  </article>;
}
