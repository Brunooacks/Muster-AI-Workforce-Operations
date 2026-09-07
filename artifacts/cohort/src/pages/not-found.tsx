import { Link } from "wouter";
import { ArrowLeft, RouteOff } from "lucide-react";
import { MusterMark } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background px-5 text-foreground">
      <main className="w-full max-w-xl rounded-3xl border border-card-border bg-card p-8 shadow-2xl sm:p-10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MusterMark className="h-7 w-7" />
          </span>
          <span>
            <strong className="block font-serif text-xl font-medium">Muster</strong>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">AI Workforce Operations</span>
          </span>
        </div>
        <RouteOff className="mt-10 h-9 w-9 text-primary" />
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Rota não encontrada · 404</p>
        <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight sm:text-4xl">Este destino não faz parte da operação atual.</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">O link pode ter sido alterado ou ainda não foi publicado. Volte ao Muster para continuar sem perder o contexto da sua sessão.</p>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Muster
        </Link>
      </main>
    </div>
  );
}
