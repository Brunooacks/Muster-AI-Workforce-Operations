/**
 * Só busca GET /executive-reports/monthly/:period quando a lista diz que o
 * período existe. Org nova (lista vazia) não dispara 404 no console.
 */
export function deveBuscarRelatorio(periodo: string, periodosGerados: string[] | undefined): boolean {
  return Array.isArray(periodosGerados) && periodosGerados.includes(periodo);
}

/** Período a exibir: o escolhido, ou o mais recente gerado se o escolhido não existe. */
export function periodoParaExibir(escolhido: string, periodosGerados: string[] | undefined, usuarioEscolheu: boolean): string {
  if (usuarioEscolheu || !periodosGerados?.length || periodosGerados.includes(escolhido)) return escolhido;
  return periodosGerados[0]!;
}
