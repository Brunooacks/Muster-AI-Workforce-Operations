import { AppLayout } from "@/components/layout";
import { useGetFleetBenchmarks } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { TrendingUp, Target } from "lucide-react";
import { ErrorState } from "@/components/query-state";
import { PageHeading, StatCard, AgentDisc } from "@/components/cohort";
import { platformLabel } from "@/lib/platforms";
import { useLang, type Lang } from "@/lib/i18n";

const cardTitleSerif = "font-serif text-xl font-medium tracking-tight";

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  bcGov: "Governança",
  bcBench: "Benchmarks",
  eyebrow: "Governança",
  title: "Benchmarks da Frota",
  subtitle:
    "Comparativo interno de retorno sobre investimento e acurácia entre todos os agentes da frota.",
  errTitle: "Não foi possível carregar os benchmarks",
  errDesc: "Tente novamente em instantes.",
  roiAvgLabel: "ROI médio da frota",
  roiAvgDelta: "Retorno sobre investimento consolidado",
  accAvgLabel: "Acurácia média da frota",
  accAvgDelta: "Qualidade média das respostas",
  roiRankTitle: "Ranking por ROI",
  roiRankDesc: "Maior retorno sobre investimento na frota",
  roiEmpty: "Sem dados de ROI.",
  accRankTitle: "Ranking por acurácia",
  accRankDesc: "Maior qualidade de resposta na frota",
  accEmpty: "Sem dados de acurácia.",
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    bcGov: "Governance",
    bcBench: "Benchmarks",
    eyebrow: "Governance",
    title: "Fleet Benchmarks",
    subtitle:
      "Internal comparison of return on investment and accuracy across every agent in the fleet.",
    errTitle: "Could not load the benchmarks",
    errDesc: "Try again in a moment.",
    roiAvgLabel: "Fleet average ROI",
    roiAvgDelta: "Consolidated return on investment",
    accAvgLabel: "Fleet average accuracy",
    accAvgDelta: "Average answer quality",
    roiRankTitle: "Ranking by ROI",
    roiRankDesc: "Highest return on investment in the fleet",
    roiEmpty: "No ROI data.",
    accRankTitle: "Ranking by accuracy",
    accRankDesc: "Highest answer quality in the fleet",
    accEmpty: "No accuracy data.",
  },
  es: {
    bcGov: "Gobernanza",
    bcBench: "Benchmarks",
    eyebrow: "Gobernanza",
    title: "Benchmarks de la Flota",
    subtitle:
      "Comparativo interno de retorno sobre la inversión y precisión entre todos los agentes de la flota.",
    errTitle: "No fue posible cargar los benchmarks",
    errDesc: "Inténtalo de nuevo en unos instantes.",
    roiAvgLabel: "ROI promedio de la flota",
    roiAvgDelta: "Retorno sobre la inversión consolidado",
    accAvgLabel: "Precisión promedio de la flota",
    accAvgDelta: "Calidad promedio de las respuestas",
    roiRankTitle: "Ranking por ROI",
    roiRankDesc: "Mayor retorno sobre la inversión en la flota",
    roiEmpty: "Sin datos de ROI.",
    accRankTitle: "Ranking por precisión",
    accRankDesc: "Mayor calidad de respuesta en la flota",
    accEmpty: "Sin datos de precisión.",
  },
};

function formatCurrencyK(value: number) {
  return `R$ ${(value / 1000).toFixed(1)}k`;
}

function RankRow({
  rank,
  id,
  name,
  platform,
  role,
  metric,
  ratio,
  barClass,
}: {
  rank: number;
  id: string;
  name: string;
  platform: string;
  role: string;
  metric: string;
  ratio: number;
  barClass: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-card-border bg-card p-3">
      <span className="w-5 shrink-0 text-center font-serif text-lg font-medium text-muted-foreground">
        {rank}
      </span>
      <AgentDisc name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/agentes/${id}`}
            className="truncate text-sm font-medium text-foreground hover:underline"
          >
            {name}
          </Link>
          <span className="shrink-0 font-mono text-sm tabular-nums">{metric}</span>
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {platformLabel(platform)} · {role}
        </span>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={barClass}
            style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%`, height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function BenchmarksPage() {
  const { data, isLoading, isError, refetch } = useGetFleetBenchmarks();
  const { lang } = useLang();
  const t = L[lang];

  const maxRoi = Math.max(1, ...(data?.byRoi.map((a) => Math.abs(a.roiPercent)) ?? [1]));
  const maxAcc = Math.max(1, ...(data?.byAccuracy.map((a) => a.accuracy) ?? [1]));

  return (
    <AppLayout breadcrumbs={[{ label: t.bcGov }, { label: t.bcBench }]}>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
        />

        {isError ? (
          <ErrorState
            title={t.errTitle}
            description={t.errDesc}
            onRetry={() => refetch()}
          />
        ) : (
          <>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : data ? (
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  icon={TrendingUp}
                  label={t.roiAvgLabel}
                  value={`${data.fleetAvgRoi > 0 ? "+" : ""}${data.fleetAvgRoi}%`}
                  delta={t.roiAvgDelta}
                  tone="up"
                />
                <StatCard
                  icon={Target}
                  label={t.accAvgLabel}
                  value={
                    <span>
                      {data.fleetAvgAccuracy}
                      <span className="text-xl text-muted-foreground">/100</span>
                    </span>
                  }
                  delta={t.accAvgDelta}
                />
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ROI ranking */}
              <Card>
                <CardHeader>
                  <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                    <TrendingUp className="h-4 w-4 text-chart-1" /> {t.roiRankTitle}
                  </CardTitle>
                  <CardDescription>{t.roiRankDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)
                  ) : data && data.byRoi.length > 0 ? (
                    data.byRoi.map((a, idx) => (
                      <RankRow
                        key={a.id}
                        rank={idx + 1}
                        id={a.id}
                        name={a.name}
                        platform={a.platform}
                        role={a.role}
                        metric={`${a.roiPercent > 0 ? "+" : ""}${a.roiPercent}% · ${formatCurrencyK(a.netValue)}`}
                        ratio={Math.abs(a.roiPercent) / maxRoi}
                        barClass="bg-chart-1"
                      />
                    ))
                  ) : (
                    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                      {t.roiEmpty}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Accuracy ranking */}
              <Card>
                <CardHeader>
                  <CardTitle className={`${cardTitleSerif} flex items-center gap-2`}>
                    <Target className="h-4 w-4 text-chart-5" /> {t.accRankTitle}
                  </CardTitle>
                  <CardDescription>{t.accRankDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)
                  ) : data && data.byAccuracy.length > 0 ? (
                    data.byAccuracy.map((a, idx) => (
                      <RankRow
                        key={a.id}
                        rank={idx + 1}
                        id={a.id}
                        name={a.name}
                        platform={a.platform}
                        role={a.role}
                        metric={`${a.accuracy}/100`}
                        ratio={a.accuracy / maxAcc}
                        barClass="bg-chart-5"
                      />
                    ))
                  ) : (
                    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                      {t.accEmpty}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
