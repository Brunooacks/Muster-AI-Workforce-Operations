import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Pendencia = {
  id: string;
  agente: string;
  aconteceu: string;
  sugestao: string;
  prazo: string;
  urgencia: "alta" | "média";
};

const PENDENCIAS: Pendencia[] = [
  {
    id: "p-1",
    agente: "Sofia",
    aconteceu: "24% das entregas do mês foram reabertas",
    sugestao: "revisar a base de cobrança que o agente usa",
    prazo: "sexta",
    urgencia: "alta",
  },
  {
    id: "p-2",
    agente: "Dora",
    aconteceu: "gasto do mês chegou a 84% do orçamento no dia 20",
    sugestao: "subir o limite ou reduzir o volume de prospecção",
    prazo: "segunda",
    urgencia: "média",
  },
  {
    id: "p-3",
    agente: "Téo",
    aconteceu: "9 entregas ficaram sem prova verificável",
    sugestao: "conectar o repositório para registrar a origem",
    prazo: "esta semana",
    urgencia: "média",
  },
];

const pt = {
  titulo: "Pendências",
  sub: "O que precisa de uma decisão sua, em ordem de urgência.",
  ilustrativo: "Dados ilustrativos",
  porque: "Por que decidiu assim? (obrigatório)",
  acao: {
    aprovar: "Aprovar",
    ajustar: "Ajustar",
    recusar: "Recusar",
  } as Record<"aprovar" | "ajustar" | "recusar", string>,
  falta: "Falta preencher: justificativa",
  aprovar: "Aprovar sugestão",
  ajustar: "Ajustar",
  recusar: "Recusar",
  confirmar: "Confirmar decisão",
  cancelar: "Voltar",
  vazio: "Nada pendente. Última verificação: agora.",
  prazo: "Prazo",
  sugerimos: "Sugerimos",
  alta: "urgência alta",
};

export function PendenciasScreen() {
  const [aberta, setAberta] = useState<string | null>(null);
  const [acao, setAcao] = useState<"aprovar" | "ajustar" | "recusar">("aprovar");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState(false);
  const [decididas, setDecididas] = useState<string[]>([]);

  const pendentes = PENDENCIAS.filter((item) => !decididas.includes(item.id));

  function confirmar(id: string) {
    if (justificativa.trim() === "") {
      setErro(true);
      return;
    }
    setDecididas((lista) => [...lista, id]);
    setAberta(null);
    setJustificativa("");
    setErro(false);
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Decisões · ordenadas por urgência
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em]">
            {pt.titulo}
          </h1>
          <Badge variant="illustrative">{pt.ilustrativo}</Badge>
        </div>
        <p className="max-w-[720px] text-[15px] leading-[1.5] text-muted-foreground">{pt.sub}</p>
      </header>

      {pendentes.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-border p-8 text-center text-[15px] text-muted-foreground">
          {pt.vazio}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendentes.map((item) => (
            <li key={item.id} className="rounded-[16px] border border-border bg-card p-4 lg:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-[1.5]">
                    <span className="font-medium">{item.agente}</span>: {item.aconteceu}.{" "}
                    <span className="text-muted-foreground">
                      {pt.sugerimos} {item.sugestao}.
                    </span>{" "}
                    {pt.prazo} {item.prazo}.
                  </p>
                  {item.urgencia === "alta" && (
                    <span className="mt-2 inline-block rounded-full border border-destructive/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-destructive">
                      {pt.alta}
                    </span>
                  )}
                </div>

                {aberta !== item.id && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAberta(item.id);
                        setAcao("aprovar");
                        setErro(false);
                      }}
                      className="rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
                    >
                      {pt.aprovar}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAberta(item.id);
                        setAcao("ajustar");
                        setErro(false);
                      }}
                      className="rounded-full border border-border px-4 py-2 text-[13px] transition-colors hover:text-foreground"
                    >
                      {pt.ajustar}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAberta(item.id);
                        setAcao("recusar");
                        setErro(false);
                      }}
                      className="rounded-full border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {pt.recusar}
                    </button>
                  </div>
                )}
              </div>

              {aberta === item.id && (
                <div className="mt-4 border-t border-border pt-4">
                  <label className="flex flex-col gap-1.5" htmlFor={`justificativa-${item.id}`}>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {pt.acao[acao]} · {pt.porque}
                    </span>
                    <Textarea
                      id={`justificativa-${item.id}`}
                      value={justificativa}
                      aria-invalid={erro ? true : undefined}
                      onChange={(event) => {
                        setJustificativa(event.target.value);
                        if (erro) setErro(false);
                      }}
                      className={cn("min-h-[72px]", erro && "border-destructive")}
                      placeholder={pt.porque}
                    />
                  </label>
                  {erro && <p className="mt-1.5 text-[12px] text-destructive">{pt.falta}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => confirmar(item.id)}
                      className="rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
                    >
                      {pt.confirmar}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAberta(null);
                        setJustificativa("");
                        setErro(false);
                      }}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {pt.cancelar}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
