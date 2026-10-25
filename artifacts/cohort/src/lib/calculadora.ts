/**
 * Muster Calculadora de Custo por Resultado (T4).
 * Cálculo no cliente, sem API. Fórmula publicada na página e coberta por testes.
 *
 *   resultados validados  = tarefas × aceitação/100
 *   custo por resultado (agente) = gasto mensal ÷ resultados validados
 *   custo humano mensal   = tarefas × minutos/60 × custo-hora
 *   custo por resultado (humano) = custo humano mensal ÷ resultados validados
 *
 * Os dois lados gastam em todas as tarefas e só a aceitação conta como
 * resultado: taxa ruim penaliza os dois, e a comparação fica justa.
 */

export interface EntradasCalculadora {
  agentes: number;
  gastoMensal: number;
  tarefas: number;
  aceitacao: number;
  custoHora: number;
  minutosPorTarefa: number;
}

export interface ResultadoCalculadora {
  resultadosValidados: number;
  custoPorResultadoAgente: number | null;
  custoPorResultadoHumano: number | null;
  custoHumanoMensal: number;
  economiaMensal: number | null;
  custoMedioPorAgente: number | null;
  agenteMaisBarato: boolean | null;
}

export type CampoEntrada = keyof EntradasCalculadora;

/** Valores iniciais: exemplos marcados como ilustrativos na página. */
export const ENTRADAS_PADRAO: EntradasCalculadora = {
  agentes: 8,
  gastoMensal: 4800,
  tarefas: 1500,
  aceitacao: 70,
  custoHora: 85,
  minutosPorTarefa: 25,
};

export type ErrosEntradas = Partial<Record<CampoEntrada, string>>;

const LIMITES: Record<CampoEntrada, { min: number; max: number; inteiro?: boolean }> = {
  agentes: { min: 1, max: 100_000, inteiro: true },
  gastoMensal: { min: 0, max: 1_000_000_000 },
  tarefas: { min: 1, max: 100_000_000, inteiro: true },
  aceitacao: { min: 1, max: 100 },
  custoHora: { min: 0, max: 1_000_000 },
  minutosPorTarefa: { min: 1, max: 480 },
};

export function validar(e: EntradasCalculadora): ErrosEntradas {
  const erros: ErrosEntradas = {};
  for (const campo of Object.keys(LIMITES) as CampoEntrada[]) {
    const valor = e[campo];
    const { min, max, inteiro } = LIMITES[campo];
    if (!Number.isFinite(valor)) {
      erros[campo] = "Falta preencher";
      continue;
    }
    if (valor < min) {
      erros[campo] =
        campo === "aceitacao"
          ? "A aceitação vai de 1% a 100%"
          : campo === "tarefas"
            ? "Informe ao menos 1 tarefa por mês"
            : campo === "agentes"
              ? "Informe ao menos 1 agente"
              : campo === "minutosPorTarefa"
                ? "Informe ao menos 1 minuto por tarefa"
                : "Não pode ser negativo";
      continue;
    }
    if (valor > max) erros[campo] = "Valor acima do limite";
    else if (inteiro && !Number.isInteger(valor)) erros[campo] = "Use um número inteiro";
  }
  return erros;
}

function finito(valor: number): number {
  return Number.isFinite(valor) ? valor : 0;
}

export function calcular(e: EntradasCalculadora): ResultadoCalculadora {
  const agentes = finito(e.agentes);
  const gastoMensal = finito(e.gastoMensal);
  const tarefas = finito(e.tarefas);
  const aceitacao = finito(e.aceitacao);
  const custoHora = finito(e.custoHora);
  const minutos = finito(e.minutosPorTarefa);

  const resultadosValidados = aceitacao > 0 ? tarefas * (aceitacao / 100) : 0;
  const tempoHoras = (tarefas * minutos) / 60;
  const custoHumanoMensal = tempoHoras * custoHora;

  const custoPorResultadoAgente = resultadosValidados > 0 ? gastoMensal / resultadosValidados : null;
  const custoPorResultadoHumano = resultadosValidados > 0 ? custoHumanoMensal / resultadosValidados : null;
  const custoMedioPorAgente = agentes > 0 ? gastoMensal / agentes : null;

  return {
    resultadosValidados,
    custoPorResultadoAgente,
    custoPorResultadoHumano,
    custoHumanoMensal,
    economiaMensal: custoPorResultadoAgente === null ? null : custoHumanoMensal - gastoMensal,
    custoMedioPorAgente,
    agenteMaisBarato:
      custoPorResultadoAgente === null || custoPorResultadoHumano === null
        ? null
        : custoPorResultadoAgente <= custoPorResultadoHumano,
  };
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const brlSemCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function formatBRL(valor: number, casasCheias = true): string {
  if (!Number.isFinite(valor)) return "—";
  return casasCheias ? brl.format(valor) : brlSemCents.format(valor);
}

export function formatNumero(valor: number, casas = 0): string {
  if (!Number.isFinite(valor)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: casas,
    minimumFractionDigits: casas,
  }).format(valor);
}

export function parseEntrada(valor: string): number {
  const semEspacos = String(valor).replace(/\s/g, "");
  if (semEspacos === "") return Number.NaN;
  // aceita vírgula decimal no padrão pt-BR: "1.500,5" → 1500.5
  const normalizado = semEspacos.includes(",")
    ? semEspacos.replace(/\./g, "").replace(",", ".")
    : semEspacos;
  return Number(normalizado);
}
