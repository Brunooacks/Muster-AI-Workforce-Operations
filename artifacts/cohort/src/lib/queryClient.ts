import { QueryClient } from "@tanstack/react-query";

/**
 * Intervalo de atualização automática da tela.
 *
 * O Muster observa frotas em operação: um agente que degradou às 14h07 não pode
 * esperar alguém apertar F5 para aparecer. A coleta já é imediata e o
 * monitoramento recalcula na hora — o que faltava era a tela acompanhar.
 *
 * Cinco segundos é o compromisso entre "parece ao vivo" e não martelar a API:
 * com `refetchIntervalInBackground` desligado (padrão do TanStack Query), a
 * aba em segundo plano não consulta nada, então uma janela esquecida aberta
 * não gera tráfego.
 */
export const REFRESH_INTERVAL_MS = 5000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Menor que o intervalo de refetch: sem isto o dado seria considerado
      // fresco por 5 minutos e o polling devolveria cache, não o estado real.
      staleTime: REFRESH_INTERVAL_MS,
      refetchInterval: REFRESH_INTERVAL_MS,
      // Só a aba visível consulta. Aba em segundo plano fica quieta.
      refetchIntervalInBackground: false,
      // Voltou para a aba: traz o estado atual antes mesmo do próximo ciclo.
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
