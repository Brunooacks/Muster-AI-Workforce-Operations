/**
 * Rótulos de período calculados no fuso do produto (America/Sao_Paulo),
 * nunca fixos no código. Ex.: em 01/11/2026 00:30 BRT → "nov/26".
 */
export const FUSO_PRODUTO = "America/Sao_Paulo";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Ano e mês (1–12) correntes no fuso do produto. */
export function anoMesNoFuso(agora: Date = new Date(), fuso = FUSO_PRODUTO): { ano: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit" }).formatToParts(agora);
  const ano = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return { ano, mes };
}

/** Rótulo curto "mmm/aa" do mês corrente + deslocamento (−1 = mês passado). */
export function rotuloMes(deslocamento = 0, agora: Date = new Date()): string {
  const { ano, mes } = anoMesNoFuso(agora);
  const indice = ano * 12 + (mes - 1) + deslocamento;
  const a = Math.floor(indice / 12);
  const m = ((indice % 12) + 12) % 12;
  return `${MESES[m]}/${String(a % 100).padStart(2, "0")}`;
}

/** "AAAA-MM" do mês corrente no fuso do produto (chave de relatório mensal). */
export function chaveMesAtual(agora: Date = new Date()): string {
  const { ano, mes } = anoMesNoFuso(agora);
  return `${ano}-${String(mes).padStart(2, "0")}`;
}
