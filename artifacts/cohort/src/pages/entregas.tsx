import { useState } from "react";
import { useLocation, useSearch } from "wouter";
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
  pedido: string;
  entregue: string;
  fonte: string | null;
};

const ENTREGAS: Entrega[] = [
  {
    id: "e-2418",
    descricao: "Ticket #48217 reclassificado e respondido",
    agente: "Sofia · Atendimento N1",
    data: "out 24",
    custo: "R$ 0,21",
    status: "Aceita",
    prova: "zendesk · 14:32",
    nota: "Rápido e certo",
    positiva: true,
    pedido: "Cliente relata cobrança duplicada e pede explicação do valor.",
    entregue: "Resposta enviada no ticket com a origem da cobrança e o prazo de estorno.",
    fonte: "ticket 48217",
  },
  {
    id: "e-2417",
    descricao: "Reembolso de R$ 320 aprovado dentro do limite",
    agente: "Sofia · Atendimento N1",
    data: "out 24",
    custo: "R$ 0,44",
    status: "Aceita",
    prova: "zendesk · 11:08",
    nota: "Documento faltando",
    positiva: false,
    pedido: "Solicitação de reembolso com recibo anexado.",
    entregue: "Reembolso aprovado dentro do limite de R$ 500 e registrado no financeiro.",
    fonte: "ticket 48204",
  },
  {
    id: "e-2416",
    descricao: "Conciliação de 320 transações fechada",
    agente: "Dora · Conciliação",
    data: "out 23",
    custo: "R$ 0,41",
    status: "Aceita",
    prova: "erp · 17:45",
    nota: "Bateu com o extrato",
    positiva: true,
    pedido: "Fechar a conciliação do dia e separar as divergências.",
    entregue: "320 transações conciliadas, 6 divergências encaminhadas com contexto.",
    fonte: "lote 2026-10-23",
  },
  {
    id: "e-2415",
    descricao: "Exceção de conciliação encaminhada ao responsável",
    agente: "Dora · Conciliação",
    data: "out 23",
    custo: "R$ 0,37",
    status: "Aguardando",
    prova: "slack · 09:02",
    nota: null,
    positiva: null,
    pedido: "Encaminhar divergência acima de R$ 1.000 para decisão humana.",
    entregue: "Divergência enviada no canal financeiro com extrato e proposta de ajuste.",
    fonte: "slack #financeiro",
  },
  {
    id: "e-2414",
    descricao: "Pull request revisado com comentários",
    agente: "Téo · Revisão",
    data: "out 23",
    custo: "R$ 0,88",
    status: "Aceita",
    prova: "github · 16:20",
    nota: "Boa cobertura",
    positiva: true,
    pedido: "Revisar o pull request #1183 antes do merge.",
    entregue: "12 comentários, 3 apontamentos de risco e recomendação de correção.",
    fonte: "pull request 1183",
  },
  {
    id: "e-2413",
    descricao: "Cobrança duplicada gerada por erro de dados",
    agente: "Sofia · Atendimento N1",
    data: "out 22",
    custo: "R$ 0,19",
    status: "Rejeitada",
    prova: "zendesk · 10:11",
    nota: "Cobrou duas vezes",
    positiva: false,
    pedido: "Emitir segunda via da fatura do cliente.",
    entregue: "Fatura gerada com valor duplicado e reenviada ao cliente.",
    fonte: "ticket 48176",
  },
  {
    id: "e-2412",
    descricao: "Relatório semanal consolidado",
    agente: "Téo · Revisão",
    data: "out 22",
    custo: "R$ 1,45",
    status: "Aguardando",
    prova: null,
    nota: null,
    positiva: null,
    pedido: "Consolidar as mudanças da semana em um relatório para o time.",
    entregue: "Relatório gerado com resumo por repositório e destaques de risco.",
    fonte: null,
  },
];

const STATUS_STYLE: Record<Status, string> = {
  Aceita: "border-primary/40 text-primary",
  Rejeitada: "border-destructive/40 text-destructive-text",
  Aguardando: "border-border text-muted-foreground",
};

const pt = {
  titulo: "Entregas",
  sub: "O que os agentes entregaram no período, com prova, custo e a percepção de quem recebeu.",
  ilustrativo: "Dados ilustrativos",
  filtros: "Filtros",
  status: ["Todos", "Aceita", "Rejeitada", "Aguardando"] as const,
  comProva: "Só com prova",
  comNegativa: "Só com 👎",
  colunas: "Entrega · agente · data · custo · status · percepção · prova",
  semProva: "sem prova anexada",
  verProva: "Ver prova",
  fecharProva: "Fechar prova",
  resumo: (comProva: number, total: number) => `${comProva} de ${total} entregas com prova`,
  vazio: "Nenhuma entrega com esses filtros. Troque o filtro ou aguarde a próxima execução.",
  vazioSemAgente: "Este agente ainda não tem entregas no período. Os primeiros dados aparecem após a primeira execução.",
  detalhe: {
    pedido: "O que foi pedido",
    entregue: "O que foi entregue",
    prova: "Prova (origem, horário e fonte)",
    custo: "Custo desta entrega",
    achou: "O que quem recebeu achou",
    semProva: "Sem prova anexada. A entrega fica aguardando registro na origem.",
    semResposta: "Sem resposta de quem recebeu.",
  },
};

export function EntregasScreen() {
  const [, setLocation] = useLocation();
  const busca = new URLSearchParams(useSearch());
  const agente = busca.get("agente");
  const [status, setStatus] = useState<(typeof pt.status)[number]>("Todos");
  const [soComProva, setSoComProva] = useState(false);
  const [soComNegativa, setSoComNegativa] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const doAgente = (entrega: Entrega) => !agente || entrega.agente.startsWith(agente);
  const lista = ENTREGAS.filter(
    (entrega) =>
      doAgente(entrega) &&
      (status === "Todos" || entrega.status === status) &&
      (!soComProva || entrega.prova !== null) &&
      (!soComNegativa || (entrega.nota !== null && entrega.positiva === false)),
  );
  const doGrupo = ENTREGAS.filter(doAgente);
  const comProva = doGrupo.filter((entrega) => entrega.prova !== null).length;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-8" data-testid="entregas-lista">
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
        {agente && (
          <button
            key="agente"
            type="button"
            onClick={() => setLocation("/entregas")}
            className="rounded-full border border-primary bg-primary/10 px-3.5 py-1.5 text-[13px] text-primary"
          >
            Agente: {agente} ×
          </button>
        )}
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
        <button
          type="button"
          aria-pressed={soComNegativa}
          onClick={() => setSoComNegativa((valor) => !valor)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
            soComNegativa
              ? "border-destructive bg-destructive/10 text-destructive-text"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {pt.comNegativa}
        </button>
      </section>

      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {pt.colunas} · {pt.resumo(comProva, doGrupo.length)}
      </p>

      {lista.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-border p-8 text-center text-[15px] text-muted-foreground">
          {agente && doGrupo.length === 0 ? pt.vazioSemAgente : pt.vazio}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((entrega) => {
            const expandida = aberta === entrega.id;
            return (
              <li
                key={entrega.id}
                className="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    <button
                      type="button"
                      aria-expanded={expandida}
                      onClick={() => setAberta(expandida ? null : entrega.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                        expandida
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground",
                      )}
                    >
                      {expandida ? pt.fecharProva : pt.verProva}
                    </button>
                  </div>
                </div>

                {expandida && (
                  <dl
                    className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2"
                    data-testid="entrega-detalhe"
                  >
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{pt.detalhe.pedido}</dt>
                      <dd className="mt-1 text-[14px] leading-[1.5]">{entrega.pedido}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{pt.detalhe.entregue}</dt>
                      <dd className="mt-1 text-[14px] leading-[1.5]">{entrega.entregue}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{pt.detalhe.prova}</dt>
                      <dd className="mt-1 text-[14px] leading-[1.5]">
                        {entrega.prova ? (
                          <>
                            {entrega.prova}
                            {entrega.fonte && <span className="text-muted-foreground"> · {entrega.fonte}</span>}
                          </>
                        ) : (
                          <span className="text-muted-foreground">{pt.detalhe.semProva}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{pt.detalhe.custo}</dt>
                      <dd className="mt-1 font-mono text-[14px]">{entrega.custo}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{pt.detalhe.achou}</dt>
                      <dd className="mt-1 text-[14px] leading-[1.5]">
                        {entrega.nota ? (
                          <>
                            <span aria-hidden="true">{entrega.positiva ? "👍" : "👎"}</span> {entrega.nota}
                          </>
                        ) : (
                          <span className="text-muted-foreground">{pt.detalhe.semResposta}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
