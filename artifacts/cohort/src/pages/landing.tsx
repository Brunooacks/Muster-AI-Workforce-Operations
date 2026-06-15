import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b flex items-center justify-between px-6 bg-card">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
            C
          </div>
          <span className="font-semibold tracking-tight text-lg">Cohort</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
            Entrar
          </Link>
          <Button asChild size="sm">
            <Link href="/sign-up">Começar</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mb-6">
          A plataforma de governança para sua frota de IA
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mb-10">
          Dê uma identidade aos seus agentes, monitore performance em 5 camadas e decida com confiança quem promover, mentorar ou aposentar.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link href="/sign-up">Criar conta</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
            <Link href="/sign-in">Acessar painel</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
