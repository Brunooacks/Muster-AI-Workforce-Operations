import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { MAPA, SELO_LEGENDA, classeSelo, type SeloMapa } from "@/lib/shell-nav";
import { cn } from "@/lib/utils";

const SELO_STYLE: Record<SeloMapa, string> = {
  NOVO: classeSelo("NOVO"),
  SUBSTITUI: classeSelo("SUBSTITUI"),
  EVOLUI: classeSelo("EVOLUI"),
  JUNTA: classeSelo("JUNTA"),
  SAI: classeSelo("SAI"),
};

const pt = {
  titulo: "Mapa do menu",
  sub: "O que era e o que virou. As rotas antigas continuam acessíveis — só saem da navegação.",
  ilustrativo: "Estrutura nova",
  legenda: "Legenda dos selos",
  colunas: ["Hoje", "Proposta", "Selo", "Rota"],
  nota: "Itens que saem do menu continuam pelas rotas antigas até haver dados para eles. Confirme com o time a regra de retorno de Equipes mistas, Jornadas A2A e Benchmarks.",
};

export function MapaScreen() {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Navegação · 11 itens em 4 grupos → 5 itens + Configurações
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em]">
            {pt.titulo}
          </h1>
          <Badge variant="illustrative">{pt.ilustrativo}</Badge>
        </div>
        <p className="max-w-[760px] text-[15px] leading-[1.5] text-muted-foreground">{pt.sub}</p>
      </header>

      <section aria-label={pt.legenda} className="flex flex-wrap gap-x-5 gap-y-2">
        {(Object.keys(SELO_LEGENDA) as SeloMapa[]).map((selo) => (
          <span key={selo} className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
                SELO_STYLE[selo],
              )}
            >
              {selo}
            </span>
            {SELO_LEGENDA[selo]}
          </span>
        ))}
      </section>

      <div className="overflow-hidden rounded-[16px] border border-border">
        <div className="hidden grid-cols-[1.2fr_1.3fr_100px_130px] gap-4 border-b border-border bg-secondary px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:grid">
          {pt.colunas.map((coluna) => (
            <span key={coluna}>{coluna}</span>
          ))}
        </div>

        <ul>
          {MAPA.map((linha) => (
            <li
              key={`${linha.hoje}-${linha.destino}`}
              className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1.2fr_1.3fr_100px_130px] md:items-center md:gap-4"
            >
              <span className="text-[14px] text-muted-foreground">
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground md:hidden">
                  {pt.colunas[0]}
                </span>
                {linha.hoje}
              </span>
              <span className="text-[14px] font-medium">
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground md:hidden">
                  {pt.colunas[1]}
                </span>
                {linha.destino}
                {linha.nota && <span className="block text-[13px] font-normal text-muted-foreground">{linha.nota}</span>}
              </span>
              <span>
                <span
                  className={cn(
                    "inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
                    SELO_STYLE[linha.selo],
                  )}
                >
                  {linha.selo}
                </span>
              </span>
              <span className="text-[13px]">
                {linha.rotaDestino ? (
                  <Link
                    href={linha.rotaDestino}
                    className="text-primary underline-offset-4 transition-colors hover:underline"
                  >
                    {linha.rotaDestino}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="max-w-[760px] text-[13px] leading-[1.5] text-muted-foreground">{pt.nota}</p>
    </div>
  );
}
