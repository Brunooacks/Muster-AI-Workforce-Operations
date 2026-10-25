import { cn } from "@/lib/utils";
import { classificarQuadrante, linhaDaMatriz, posicaoRelativa, type PontoMatriz, type Quadrante } from "@/lib/visao-geral";
import { formatBRL, formatNumero } from "@/lib/calculadora";

/**
 * Gráficos da Visão geral (T6): gasto do mês vs orçamento, custo por
 * resultado vs custo humano, tarefa vs resultado e matriz custo × resultado.
 * SVG/CSS puro, tokens --wo-* do shell para seguir a paleta ativa.
 */

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--wo-line)] bg-[var(--wo-card-2)] px-4 py-6 text-center text-[11px] leading-relaxed text-[var(--wo-muted)]">
      {texto}
    </p>
  );
}

export function ComoCalculamos({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-3 rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] px-3 py-2">
      <summary className="cursor-pointer list-none text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--wo-muted)]">
        Como calculamos
      </summary>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--wo-muted)]">{children}</p>
    </details>
  );
}

/** Gasto do período contra o orçamento, com zonas de atenção. */
export function GraficoGastoOrcamento({
  gasto,
  orcamento,
  percentual,
  periodo,
  aviso,
}: {
  gasto: number | null;
  orcamento: number | null;
  percentual: number | null;
  periodo: string;
  aviso?: string;
}) {
  if (gasto == null || orcamento == null || percentual == null) {
    return <Vazio texto={aviso ?? "Sem gasto registrado no período."} />;
  }
  const zonas = [
    { ate: 70, cor: "var(--wo-accent)", rotulo: "dentro do combinado" },
    { ate: 90, cor: "var(--wo-warning)", rotulo: "atenção" },
    { ate: 100, cor: "var(--wo-danger)", rotulo: "limite do orçamento" },
  ];
  const preenchido = Math.min(100, Math.max(0, percentual));

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <strong className="font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{formatBRL(gasto)}</strong>
        <span className="text-xs text-[var(--wo-muted)]">de {formatBRL(orcamento)} orçados · {percentual}%</span>
      </div>
      <div className="relative mt-3 h-8 overflow-hidden rounded-lg bg-[var(--wo-card-2)]">
        {zonas.map((zona, index) => (
          <span
            key={zona.rotulo}
            className="absolute top-0 bottom-0 opacity-30"
            style={{
              left: `${index === 0 ? 0 : zonas[index - 1]!.ate}%`,
              width: `${zona.ate - (index === 0 ? 0 : zonas[index - 1]!.ate)}%`,
              background: zona.cor,
            }}
          />
        ))}
        <span
          className="absolute top-0 bottom-0 left-0 rounded-l-lg"
          style={{ width: `${preenchido}%`, background: percentual > 90 ? "var(--wo-danger)" : percentual > 70 ? "var(--wo-warning)" : "var(--wo-accent)" }}
        />
        <span className="absolute top-0 bottom-0 right-0 w-0.5 bg-[var(--wo-text)] opacity-60" aria-hidden="true" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--wo-muted)]">
        {zonas.map((zona) => (
          <span key={zona.rotulo} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm opacity-70" style={{ background: zona.cor }} />
            {zona.rotulo}
          </span>
        ))}
        <span className="font-mono">{periodo}</span>
      </div>
    </div>
  );
}

/** Custo por resultado com o Muster vs. o mesmo resultado feito à mão. */
export function GraficoCustoResultado({
  muster,
  humano,
  periodo,
  aviso,
}: {
  muster: number | null;
  humano: number | null;
  periodo: string;
  aviso?: string;
}) {
  if (muster == null) return <Vazio texto={aviso ?? "Sem custo por resultado no período."} />;
  if (humano == null || humano <= 0) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <strong className="font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{formatBRL(muster)}</strong>
          <span className="text-xs text-[var(--wo-muted)]">por entrega aceita · {periodo}</span>
        </div>
        <Vazio texto="Sem referência de custo humano no período. Defina o custo-hora em Configurações → Custos para comparar." />
      </div>
    );
  }

  const linhas = [
    { rotulo: "Com o Muster", valor: muster, cor: "var(--wo-primary)" },
    { rotulo: "Feito à mão (referência)", valor: humano, cor: "var(--wo-muted)" },
  ];
  const maior = Math.max(muster, humano, 1e-9);
  const diferenca = Math.round(Math.abs(1 - muster / humano) * 100);
  const comparacao =
    muster < humano
      ? `${diferenca}% mais barato que a revisão humana`
      : muster > humano
        ? `${diferenca}% mais caro que a revisão humana`
        : "Mesmo custo da revisão humana";

  return (
    <div>
      <div className="space-y-3">
        {linhas.map((linha) => (
          <div key={linha.rotulo}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-[var(--wo-muted)]">{linha.rotulo}</span>
              <strong className="font-mono font-medium tabular-nums text-[var(--wo-text)]">{formatBRL(linha.valor)}</strong>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[var(--wo-card-2)]">
              <span className="block h-full rounded-full" style={{ width: `${(linha.valor / maior) * 100}%`, background: linha.cor }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--wo-muted)]">
        {comparacao} para o mesmo resultado, no período de {periodo}.
      </p>
    </div>
  );
}

/** Tarefa no prazo vs. resultado aceito, no estilo do handoff. */
export function GraficoTarefaResultado({
  noPrazo,
  metaPrazo,
  resultado,
  metaResultado,
  periodo,
  vazio,
}: {
  noPrazo: number | null;
  metaPrazo: number;
  resultado: number | null;
  metaResultado: number;
  periodo: string;
  vazio?: string;
}) {
  if (noPrazo == null || resultado == null) return <Vazio texto={vazio ?? "Sem dado de prazo e resultado no período."} />;

  const barras = [
    { rotulo: "Tarefa entregue no prazo", valor: noPrazo, meta: metaPrazo, cor: "var(--wo-accent)" },
    { rotulo: "Tarefa com resultado aceito", valor: resultado, meta: metaResultado, cor: "var(--wo-primary)" },
  ];

  return (
    <div className="space-y-4">
      {barras.map((barra) => (
        <div key={barra.rotulo}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-xs text-[var(--wo-muted)]">{barra.rotulo}</span>
            <strong className="font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{barra.valor}%</strong>
          </div>
          <div className="relative mt-2 h-4 overflow-hidden rounded-full bg-[var(--wo-card-2)]">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, Math.max(0, barra.valor))}%`, background: barra.cor }} />
            <span
              className="absolute inset-y-0 w-0.5 bg-[var(--wo-text)] opacity-70"
              style={{ left: `${Math.min(100, Math.max(0, barra.meta))}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[var(--wo-muted)]">
            <span>meta {barra.meta}%</span>
            <span className={cn("font-mono", barra.valor >= barra.meta ? "text-[var(--wo-accent)]" : "text-[var(--wo-warning-text)]")}>
              {barra.valor >= barra.meta ? "dentro do combinado" : "abaixo do combinado"}
            </span>
          </div>
        </div>
      ))}
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">{periodo}</p>
    </div>
  );
}

const QUADRANTES: Array<{ nome: Quadrante; lado: "top-left" | "top-right" | "bottom-left" | "bottom-right"; cor: string; texto: string }> = [
  { nome: "Ampliar", lado: "top-left", cor: "var(--wo-primary)", texto: "resultado alto e custo baixo: escalar" },
  { nome: "Corrigir", lado: "top-right", cor: "var(--wo-warning)", texto: "resultado alto e custo alto: otimizar" },
  { nome: "Observar", lado: "bottom-left", cor: "var(--wo-muted)", texto: "resultado baixo e custo baixo: monitorar" },
  { nome: "Desligar", lado: "bottom-right", cor: "var(--wo-danger)", texto: "resultado baixo e custo alto: encerrar" },
];

const LADO_CLASS: Record<string, string> = {
  "top-left": "left-0 top-0 items-start text-left",
  "top-right": "right-0 top-0 items-end text-right",
  "bottom-left": "left-0 bottom-0 items-start text-left",
  "bottom-right": "right-0 bottom-0 items-end text-right",
};

/** Matriz custo × resultado com os quadrantes de decisão. */
export function MatrizCustoResultado({
  pontos,
  eixoCusto,
  eixoResultado,
  vazio,
}: {
  pontos: PontoMatriz[];
  eixoCusto: string;
  eixoResultado: string;
  vazio?: string;
}) {
  if (pontos.length === 0) return <Vazio texto={vazio ?? "Sem dados suficientes para a matriz."} />;
  const { custo: linhaCusto, resultado: linhaResultado } = linhaDaMatriz(pontos);

  return (
    <div>
      <div className="relative aspect-square w-full max-w-[420px]">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {QUADRANTES.map((quadrante, index) => (
            <div
              key={quadrante.nome}
              className={cn("flex flex-col gap-1 p-3", LADO_CLASS[quadrante.lado])}
              style={{
                background: `color-mix(in srgb, ${quadrante.cor} 8%, transparent)`,
                borderRight: index % 2 === 0 ? "1px dashed var(--wo-line)" : undefined,
                borderBottom: index < 2 ? "1px dashed var(--wo-line)" : undefined,
              }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: quadrante.cor }}>
                {quadrante.nome}
              </span>
              <span className="max-w-[150px] text-[10px] leading-snug text-[var(--wo-muted)]">{quadrante.texto}</span>
            </div>
          ))}
        </div>
        {pontos.map((ponto) => {
          const x = posicaoRelativa(ponto.custo, linhaCusto);
          const y = posicaoRelativa(ponto.resultado, linhaResultado);
          const quadrante = classificarQuadrante(ponto.custo, ponto.resultado, linhaCusto, linhaResultado);
          const cor = QUADRANTES.find((item) => item.nome === quadrante)!.cor;
          return (
            <span
              key={ponto.nome}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-1 font-mono text-[10px] font-medium shadow"
              style={{ left: `${x}%`, top: `${100 - y}%`, background: cor, color: "var(--wo-shell)" }}
              title={`${ponto.nome}: ${formatBRL(ponto.custo)} por entrega · ${Math.round(ponto.resultado)}% de resultado`}
            >
              {ponto.nome}
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--wo-muted)]">
        <span>{eixoResultado} ↑</span>
        <span>{eixoCusto} →</span>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {pontos.map((ponto) => {
          const quadrante = classificarQuadrante(ponto.custo, ponto.resultado, linhaCusto, linhaResultado);
          return (
            <li key={ponto.nome} className="flex items-center gap-2 text-[11px] text-[var(--wo-muted)]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: QUADRANTES.find((item) => item.nome === quadrante)!.cor }} />
              <strong className="font-medium text-[var(--wo-text)]">{ponto.nome}</strong>
              <span className="font-mono">{formatBRL(ponto.custo)}/entrega · {formatNumero(ponto.resultado)}%</span>
              <span className="rounded-full border border-[var(--wo-line)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]">{quadrante}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
