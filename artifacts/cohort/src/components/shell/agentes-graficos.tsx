import { cn } from "@/lib/utils";
import {
  ROTULO_COBERTURA,
  ROTULO_STATUS,
  TEXTO_COBERTURA,
  friccaoEmpilhada,
  type BulletMeta as BulletDaMeta,
  type Cobertura,
  type StatusAgente,
} from "@/lib/agentes";

/**
 * Gráficos de Agentes (T7): selo de cobertura (aberta/parcial/fechada),
 * bullet chart da meta contra a linha de base e fricção empilhada por tipo.
 * SVG/CSS puro com os tokens --wo-* do shell.
 */

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--wo-line)] bg-[var(--wo-card-2)] px-4 py-6 text-center text-[11px] leading-relaxed text-[var(--wo-muted)]">
      {texto}
    </p>
  );
}

const CORES_STATUS: Record<StatusAgente, string> = {
  fora: "border-[var(--wo-danger)] text-[var(--wo-danger-text)]",
  atencao: "border-[var(--wo-warning)] text-[var(--wo-warning-text)]",
  "sem-dados": "border-[var(--wo-line)] text-[var(--wo-muted)]",
  dentro: "border-[var(--wo-accent)] text-[var(--wo-accent)]",
};

/** Status do agente em linguagem comum. */
export function ChipStatus({ status }: { status: StatusAgente }) {
  return (
    <span
      data-testid="status-agente"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]",
        CORES_STATUS[status],
      )}
    >
      {ROTULO_STATUS[status]}
    </span>
  );
}

const CORES_COBERTURA: Record<Cobertura, string> = {
  fechada: "border-[var(--wo-accent)] text-[var(--wo-accent)]",
  parcial: "border-[var(--wo-warning)] text-[var(--wo-warning-text)]",
  aberta: "border-[var(--wo-line)] text-[var(--wo-muted)]",
};

/** Selo de cobertura da meta: aberta, parcial ou fechada. */
export function SeloCobertura({ cobertura, className }: { cobertura: Cobertura; className?: string }) {
  return (
    <span
      title={TEXTO_COBERTURA[cobertura]}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]",
        CORES_COBERTURA[cobertura],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {ROTULO_COBERTURA[cobertura]}
    </span>
  );
}

function numero(valor: number | null, unidade: string | null): string {
  if (valor == null) return "—";
  const formatado = unidade === "%"
    ? `${Number.isInteger(valor) ? valor : valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    : unidade === "R$"
      ? `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unidade ? ` ${unidade}` : ""}`;
  return formatado;
}

/** Bullet chart de uma meta: atual contra a linha de base e o combinado. */
export function BulletMeta({ bullet, periodo, semRotulo = false }: { bullet: BulletDaMeta; periodo: string; semRotulo?: boolean }) {
  if (bullet.atual == null) {
    return <Vazio texto={`Sem dado no período para “${bullet.rotulo}”. Ele aparece após a primeira execução com prova.`} />;
  }

  const escala = Math.max(bullet.antes ?? 0, bullet.combinado ?? 0, bullet.atual) * 1.15 || 1;
  const largura = (valor: number | null) => (valor == null ? 0 : Math.min(100, (valor / escala) * 100));
  const cor = bullet.ok == null ? "var(--wo-primary)" : bullet.ok ? "var(--wo-accent)" : "var(--wo-danger)";

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {!semRotulo && <span className="truncate text-xs font-medium text-[var(--wo-text)]">{bullet.rotulo}</span>}
        <span className="flex items-baseline gap-2">
          <strong className={cn("font-mono text-lg font-medium tabular-nums", bullet.ok === false ? "text-[var(--wo-danger-text)]" : "text-[var(--wo-text)]")}>
            {numero(bullet.atual, bullet.unidade)}
          </strong>
          <span className="text-[10px] text-[var(--wo-muted)]">últimos 30 dias</span>
        </span>
      </div>
      <div className="relative mt-2 h-3.5 overflow-hidden rounded-full bg-[var(--wo-card-2)]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${largura(bullet.atual)}%`, background: cor }} />
        {bullet.antes != null && (
          <span
            className="absolute inset-y-0 w-px border-l border-dashed border-[var(--wo-muted)]"
            style={{ left: `${largura(bullet.antes)}%` }}
            aria-hidden="true"
          />
        )}
        {bullet.combinado != null && (
          <span
            className="absolute inset-y-0 w-0.5 bg-[var(--wo-text)] opacity-70"
            style={{ left: `${largura(bullet.combinado)}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--wo-muted)]">
        <span>antes do agente {numero(bullet.antes, bullet.unidade)}</span>
        <span>combinado {bullet.combinadoTexto}</span>
        <span className="font-mono">{periodo}</span>
        <span className={cn("font-mono uppercase tracking-[0.08em]", bullet.ok === false ? "text-[var(--wo-danger-text)]" : bullet.ok ? "text-[var(--wo-accent)]" : "")}>
          {bullet.ok == null ? "sem meta" : bullet.ok ? "dentro do combinado" : "abaixo do combinado"}
        </span>
      </div>
    </div>
  );
}

const CORES_FRICCAO = [
  "var(--wo-danger)",
  "var(--wo-warning)",
  "var(--wo-primary)",
  "var(--wo-muted)",
  "var(--wo-accent)",
];

/** Fricção empilhada por tipo no período. */
export function FriccaoEmpilhada({
  segmentos,
  totalEntregas,
  periodo,
  vazio,
}: {
  segmentos: Array<{ tipo: string; quantidade: number }>;
  totalEntregas: number | null;
  periodo: string;
  vazio?: string;
}) {
  const blocos = friccaoEmpilhada(segmentos);
  if (blocos.length === 0) {
    return <Vazio texto={vazio ?? "Sem fricção registrada no período."} />;
  }
  const total = blocos.reduce((soma, item) => soma + item.quantidade, 0);
  const participacao = totalEntregas && totalEntregas > 0 ? Math.round((total / totalEntregas) * 100) : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="font-mono text-2xl font-medium tabular-nums text-[var(--wo-text)]">{total}</strong>
        <span className="text-xs text-[var(--wo-muted)]">
          execuções com atrito de {totalEntregas ?? "—"}{participacao != null ? ` · ${participacao}%` : ""}
        </span>
      </div>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-[var(--wo-card-2)]">
        {blocos.map((bloco, index) => (
          <span
            key={bloco.tipo}
            className="h-full"
            style={{ width: `${bloco.percentual}%`, background: CORES_FRICCAO[index % CORES_FRICCAO.length] }}
            title={`${bloco.tipo}: ${bloco.quantidade} (${bloco.percentual}%)`}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {blocos.map((bloco, index) => (
          <li key={bloco.tipo} className="flex items-center gap-2 text-[11px] text-[var(--wo-muted)]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: CORES_FRICCAO[index % CORES_FRICCAO.length] }} />
            <span className="min-w-0 flex-1 truncate">{bloco.tipo}</span>
            <strong className="font-mono font-medium text-[var(--wo-text)]">{bloco.quantidade}</strong>
            <span className="font-mono">{bloco.percentual}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">{periodo}</p>
    </div>
  );
}
