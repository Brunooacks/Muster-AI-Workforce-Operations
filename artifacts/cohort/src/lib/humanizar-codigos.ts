/**
 * RG-M22: códigos internos (status, tipo de padrão, veredito) nunca aparecem
 * crus na tela. Texto vindo do backend passa por aqui antes de renderizar.
 */
const ROTULOS: Record<string, string> = {
  "continuous-governance": "Governança contínua",
  insufficient_data: "dados insuficientes",
  not_measured: "não medido",
  mentor: "mentorar",
  retire: "aposentar",
  promote: "promover",
  observation: "em observação",
  regression: "em regressão",
  maintain: "manter",
  stable: "estável",
  regressing: "em queda",
  improving: "em alta",
  grounded: "fundamentado",
  ungrounded: "sem fundamentação",
  task_id: "identificador de tarefa",
};

export function rotuloCodigo(codigo: string | null | undefined, fallback = ""): string {
  if (!codigo) return fallback;
  return ROTULOS[codigo] ?? codigo;
}

export function humanizarCodigos(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto.replace(/\b(continuous-governance|insufficient_data|not_measured|mentor|retire|promote|maintain|stable|regressing|improving|grounded|ungrounded|regression|task_id)\b/g, (m) => ROTULOS[m] ?? m);
}
