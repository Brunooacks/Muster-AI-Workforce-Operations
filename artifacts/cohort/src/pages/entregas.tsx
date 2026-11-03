import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { getAgentOutcome, getGetAgentOutcomeQueryKey } from "@workspace/api-client-react";
import { resumirEntregas, reais, pct } from "@/lib/entregas-resumo";
import type { OutcomePayload } from "@/lib/agent-outcome-view";
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

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rotuloMes(p: string): string {
  const [ano, mes] = p.split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}
function ultimosMeses(n: number): string[] {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - i, 1)).toISOString().slice(0, 7));
}

function Kpi({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-card p-4", destaque && "border-primary/40 bg-primary/5")}>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{rotulo}</span>
      <strong className="font-mono text-[22px] font-medium tabular-nums leading-tight sm:text-[26px]">{valor}</strong>
      {detalhe && <span className="text-[12px] leading-snug text-muted-foreground">{detalhe}</span>}
    </div>
  );
}

function Barra({ valor }: { valor: number | null }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((valor ?? 0) * 100)}%` }} />
    </div>
  );
}

/**
 * Área logada (RG-M21): consolida o resultado real de cada agente no mês
 * (GET /agents/:id/outcome) em KPIs, mix de aceite e ranking por agente.
 * A lista ilustrativa nunca aparece aqui.
 */
export function EntregasOperacional({ agentes }: { agentes: Array<{ id: string; name: string; role?: string | null }> }) {
  const meses = ultimosMeses(3);
  const [periodo, setPeriodo] = useState(meses[0]!);
  const consultas = useQueries({
    queries: agentes.map((a) => ({
      queryKey: getGetAgentOutcomeQueryKey(a.id, { period: periodo }),
      queryFn: () => getAgentOutcome(a.id, { period: periodo }),
    })),
  });
  const carregando = consultas.some((c) => c.isLoading);
  const r = resumirEntregas(agentes.map((a, i) => ({ id: a.id, nome: a.name, papel: a.role ?? "", outcome: consultas[i]?.data as OutcomePayload | undefined })));
  const semAgentes = agentes.length === 0;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6 lg:px-8" data-testid="entregas-operacional">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Operação · {rotuloMes(periodo)}</span>
          <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em]">{pt.titulo}</h1>
          <p className="max-w-[640px] text-[15px] leading-[1.5] text-muted-foreground">Tarefas que os agentes concluíram, quantas foram aceitas, quanto custou cada uma e quanto custaria fazer com pessoas.</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Período">
          {meses.map((m) => (
            <button key={m} type="button" aria-pressed={periodo === m} onClick={() => setPeriodo(m)}
              className={cn("rounded-full border px-3.5 py-1.5 text-[13px] transition-colors", periodo === m ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground")}>
              {rotuloMes(m)}
            </button>
          ))}
        </div>
      </header>

      {semAgentes ? (
        <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-[15px] font-medium">Ainda não há entregas registradas.</p>
          <p className="mx-auto mt-2 max-w-[560px] text-[13px] text-muted-foreground">Adicione e conecte um agente. As entregas aparecem aqui depois da primeira execução.</p>
          <a href="/conectores" className="mt-5 inline-flex rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">Conectar agente</a>
        </section>
      ) : carregando ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Indicadores do período">
            <Kpi rotulo="Entregas" valor={r.entregas.toLocaleString("pt-BR")} detalhe={`${agentes.length} agentes no período`} />
            <Kpi rotulo="Aceitas" valor={r.aceitas.toLocaleString("pt-BR")} detalhe={`${pct(r.taxaAceite)} de aceite`} />
            <Kpi rotulo="Custo por entrega aceita" valor={reais(r.custoPorAceitaCents)} detalhe={`total ${reais(r.custoTotalCents)}`} />
            <Kpi rotulo="Se fosse feito por pessoas" valor={reais(r.custoHumanoEquivalenteCents)} detalhe="custo-hora × minutos de referência" />
            <Kpi rotulo="Economia no período" valor={reais(r.economiaCents)} detalhe={r.economiaPct != null ? `${pct(r.economiaPct)} abaixo do custo humano` : "cadastre custo-hora e contrato"} destaque />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Como as entregas foram aceitas">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Como as entregas foram aceitas</h2>
              <span className="text-[12px] text-muted-foreground">{r.aceitas.toLocaleString("pt-BR")} aceitas · {(r.entregas - r.aceitas).toLocaleString("pt-BR")} recusadas ou em aberto</span>
            </div>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${Math.round((r.taxaAceite ?? 0) * (r.aceiteAuto ?? 0) * 100)}%` }} />
              <div className="h-full bg-primary/45" style={{ width: `${Math.round((r.taxaAceite ?? 0) * (r.aceiteHumano ?? 0) * 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary" />Aceite automático por regra · {pct(r.aceiteAuto)}</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary/45" />Aprovada por pessoa · {pct(r.aceiteHumano)}</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />Recusada ou em aberto · {pct(r.taxaAceite == null ? null : 1 - r.taxaAceite)}</span>
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-label="Entregas por agente">
            <h2 className="text-[15px] font-semibold">Por agente</h2>
            <ul className="flex flex-col gap-2">
              {r.agentes.map((a) => (
                <li key={a.id}>
                  <a href={`/agentes/${a.id}`} className="grid grid-cols-2 items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/40 lg:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))]">
                    <div className="col-span-2 min-w-0 lg:col-span-1">
                      <p className="truncate text-[15px] font-medium">{a.nome}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{a.papel}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Entregas</span>
                      <span className="font-mono text-[15px] tabular-nums">{a.entregas.toLocaleString("pt-BR")}{a.aceitas != null && <span className="text-muted-foreground"> · {a.aceitas.toLocaleString("pt-BR")} aceitas</span>}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Aceite</span>
                      <span className="font-mono text-[15px] tabular-nums">{pct(a.taxaAceite)}</span>
                      <Barra valor={a.taxaAceite} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Custo por aceita</span>
                      <span className="font-mono text-[15px] tabular-nums">{reais(a.custoPorAceitaCents)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Custo humano</span>
                      <span className="font-mono text-[15px] tabular-nums">{reais(a.custoHumanoCents)}{a.economiaPct != null && <span className="text-primary"> · −{pct(a.economiaPct)}</span>}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

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
