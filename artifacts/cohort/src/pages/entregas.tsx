import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "Aceita" | "Rejeitada" | "Aguardando";

type Entrega = {
  id: string;
  descricao: string;
  agente: string;
  data: string;
  custo: string;
  status: Status;
  prova: string | null;
  nota: string | null;
  positiva: boolean | null;
};

const ENTREGAS: Entrega[] = [
  { id: "e-2418", descricao: "Ticket #48217 reclassificado e respondido", agente: "Sofia · Atendimento N1", data: "out 24", custo: "R$ 0,21", status: "Aceita", prova: "zendesk · 14:32", nota: "Rápido e certo", positiva: true },
  { id: "e-2417", descricao: "Reembolso de R$ 320 aprovado dentro do limite", agente: "Sofia · Atendimento N1", data: "out 24", custo: "R$ 0,44", status: "Aceita", prova: "zendesk · 11:08", nota: "Documento faltando", positiva: false },
  { id: "e-2416", descricao: "Proposta comercial personalizada enviada", agente: "Dora · Prospecting", data: "out 23", custo: "R$ 1,12", status: "Aceita", prova: "hubspot · 17:45", nota: "Cliente perguntou preço", positiva: true },
  { id: "e-2415", descricao: "Resumo diário do pipeline enviado ao time", agente: "Dora · Prospecting", data: "out 23", custo: "R$ 0,37", status: "Aguardando", prova: "slack · 09:02", nota: null, positiva: null },
  { id: "e-2414", descricao: "Pull request revisado com comentários", agente: "Téo · Revisão", data: "out 23", custo: "R$ 0,88", status: "Aceita", prova: "github · 16:20", nota: "Boa cobertura", positiva: true },
  { id: "e-2413", descricao: "Cobrança duplicada gerada por erro de dados", agente: "Sofia · Atendimento N1", data: "out 22", custo: "R$ 0,19", status: "Rejeitada", prova: "zendesk · 10:11", nota: "Cobrou duas vezes", positiva: false },
  { id: "e-2412", descricao: "Relatório semanal consolidado", agente: "Téo · Revisão", data: "out 22", custo: "R$ 1,45", status: "Aguardando", prova: null, nota: null, positiva: null },
];

const STATUS_STYLE: Record<Status, string> = {
  Aceita: "border-primary/40 text-primary",
  Rejeitada: "border-destructive/40 text-destructive",
  Aguardando: "border-border text-muted-foreground",
};

const pt = {
  titulo: "Entregas",
  sub: "O que os agentes entregaram no período, com prova e percepção de quem recebeu.",
  ilustrativo: "Dados ilustrativos",
  filtros: "Filtros",
  status: ["Todos", "Aceita", "Rejeitada", "Aguardando"] as const,
  comProva: "Só com prova",
  colunas: "Entrega · agente · data · custo · status · percepção",
  semProva: "sem prova anexada",
  vazio: "Nenhuma entrega com esses filtros. Troque o filtro ou aguarde a próxima execução.",
};

export function EntregasScreen() {
  const [status, setStatus] = useState<(typeof pt.status)[number]>("Todos");
  const [soComProva, setSoComProva] = useState(false);

  const lista = ENTREGAS.filter(
    (entrega) =>
      (status === "Todos" || entrega.status === status) &&
      (!soComProva || entrega.prova !== null),
  );

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Operação · últimos 30 dias
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em]">
            {pt.titulo}
          </h1>
          <Badge variant="illustrative">{pt.ilustrativo}</Badge>
        </div>
        <p className="max-w-[720px] text-[15px] leading-[1.5] text-muted-foreground">{pt.sub}</p>
      </header>

      <section className="flex flex-wrap items-center gap-2" aria-label={pt.filtros}>
        {pt.status.map((opcao) => (
          <button
            key={opcao}
            type="button"
            aria-pressed={status === opcao}
            onClick={() => setStatus(opcao)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              status === opcao
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {opcao}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={soComProva}
          onClick={() => setSoComProva((valor) => !valor)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
            soComProva
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {pt.comProva}
        </button>
      </section>

      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {pt.colunas}
      </p>

      {lista.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-border p-8 text-center text-[15px] text-muted-foreground">
          {pt.vazio}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((entrega) => (
            <li
              key={entrega.id}
              className="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-[1.4]">{entrega.descricao}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {entrega.agente} · {entrega.data} · {entrega.custo}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {entrega.nota && (
                  <span className="text-[13px] text-muted-foreground">
                    <span aria-hidden="true">{entrega.positiva ? "👍" : "👎"}</span> {entrega.nota}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
                    STATUS_STYLE[entrega.status],
                  )}
                >
                  {entrega.status}
                </span>
                {entrega.prova ? (
                  <span className="text-[13px] text-primary">{entrega.prova}</span>
                ) : (
                  <span className="text-[13px] text-muted-foreground">{pt.semProva}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
