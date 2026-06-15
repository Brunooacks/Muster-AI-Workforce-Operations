import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Fingerprint,
  Layers,
  Gavel,
  AlertTriangle,
  Users,
  Plug,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from "lucide-react";

const layers = [
  { label: "Eficácia", score: 88, color: "hsl(var(--chart-1))" },
  { label: "Eficiência", score: 74, color: "hsl(var(--chart-2))" },
  { label: "Adoção", score: 81, color: "hsl(var(--chart-1))" },
  { label: "Governança", score: 67, color: "hsl(var(--chart-2))" },
  { label: "Valor", score: 92, color: "hsl(var(--chart-1))" },
];

const features = [
  {
    icon: Fingerprint,
    title: "Admissão & Identidade",
    desc: "Descubra agentes via conectores e admita-os na frota com identidade e carteira de trabalho.",
  },
  {
    icon: Layers,
    title: "Avaliação em 5 camadas",
    desc: "Eficácia, eficiência, adoção, governança e valor — uma leitura completa de cada agente.",
  },
  {
    icon: Gavel,
    title: "Veredito do Comitê",
    desc: "Promover, Mentorar ou Aposentar — com nível de confiança, janela de execução e plano de ação.",
  },
  {
    icon: AlertTriangle,
    title: "Detector de Vitória Ilusória",
    desc: "Sinaliza padrões enganosos de sucesso antes que eles custem caro à operação.",
  },
  {
    icon: Users,
    title: "Comitê & Governança",
    desc: "Donos de negócio, técnico e sponsor definidos por agente, com responsabilidades claras.",
  },
  {
    icon: Plug,
    title: "Plug-and-play",
    desc: "Arquitetura de conectores pronta para múltiplas plataformas, sem reescrever a interface.",
  },
];

const verdicts = [
  { label: "Promover", icon: TrendingUp, className: "text-chart-1", count: "12" },
  { label: "Mentorar", icon: Minus, className: "text-chart-2", count: "7" },
  { label: "Aposentar", icon: TrendingDown, className: "text-destructive", count: "3" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 h-16 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
            C
          </div>
          <span className="font-semibold tracking-tight text-lg">Cohort</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Entrar
          </Link>
          <Button asChild size="sm">
            <Link href="/sign-up">Começar</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div
            className="absolute -top-24 -right-24 -z-10 h-96 w-96 rounded-full blur-3xl opacity-20"
            style={{ background: "hsl(var(--primary))" }}
          />

          <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Governança para frotas de agentes de IA
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.05]">
                Sua frota de IA,{" "}
                <span className="text-primary">sob controle</span>.
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                Dê identidade e carteira de trabalho aos seus agentes, avalie o
                desempenho em 5 camadas e decida com confiança quem{" "}
                <strong className="text-foreground font-semibold">promover</strong>,{" "}
                <strong className="text-foreground font-semibold">mentorar</strong> ou{" "}
                <strong className="text-foreground font-semibold">aposentar</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button asChild size="lg" className="h-12 px-8 text-base">
                  <Link href="/sign-up">
                    Criar conta <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 px-8 text-base"
                >
                  <Link href="/sign-in">Acessar painel</Link>
                </Button>
              </div>
            </div>

            {/* Hero preview card */}
            <div className="relative">
              <div className="rounded-2xl border bg-card shadow-xl shadow-black/[0.03] p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Perfil de desempenho
                    </p>
                    <p className="font-semibold">Frota · 22 agentes</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Saúde média</p>
                    <p className="text-2xl font-bold text-primary">80</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {layers.map((l) => (
                    <div key={l.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{l.label}</span>
                        <span className="tabular-nums font-semibold">
                          {l.score}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${l.score}%`,
                            backgroundColor: l.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-5 border-t grid grid-cols-3 gap-3">
                  {verdicts.map((v) => (
                    <div
                      key={v.label}
                      className="rounded-lg bg-muted/50 p-3 text-center"
                    >
                      <v.icon className={`h-4 w-4 mx-auto mb-1 ${v.className}`} />
                      <p className="text-lg font-bold tabular-nums">{v.count}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {v.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section className="border-y bg-card/50">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-2 text-center">
              {["Admissão", "Avaliação", "Veredito"].map((step, i) => (
                <div
                  key={step}
                  className="flex items-center gap-4 sm:gap-2"
                >
                  <div className="flex items-center gap-3 rounded-full border bg-background px-5 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{step}</span>
                  </div>
                  {i < 2 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90 sm:rotate-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Tudo que sua frota precisa para prestar contas
            </h2>
            <p className="text-muted-foreground">
              Da descoberta ao veredito, a Cohort transforma agentes dispersos em
              uma operação governada e mensurável.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border bg-card p-6 hover-elevate transition-all"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Comece a governar sua frota hoje
              </h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Admita seus primeiros agentes em minutos e tenha o primeiro
                veredito do comitê ainda hoje.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="h-12 px-8 text-base"
              >
                <Link href="/sign-up">
                  Criar conta gratuita <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              C
            </div>
            <span className="font-medium text-foreground">Cohort</span>
          </div>
          <p>Governança para frotas de agentes de IA.</p>
        </div>
      </footer>
    </div>
  );
}
