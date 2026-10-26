import type { WorkforceScreen } from "./workforce-routing";

/**
 * Menu reduzido da área logada (T5 · referencias §2 "Menu reduzido: página-mapa").
 * Cinco itens fixos + Configurações no rodapé; as rotas antigas continuam
 * acessíveis e a página /mapa mostra de onde cada item antigo veio.
 */

export type Selo = "NOVO" | "SUBSTITUI" | "EVOLUI" | "JUNTA";
export type SeloMapa = Selo | "SAI";

export type ShellNavItem = {
  screen: WorkforceScreen;
  label: string;
  path: string;
  selo: Selo;
  /** de onde veio o item, para o /mapa e para o selo da tela */
  origem: string;
};

export const SHELL_NAV: ShellNavItem[] = [
  {
    screen: "today",
    label: "Visão geral",
    path: "/comando",
    selo: "EVOLUI",
    origem: "Visão gerencial",
  },
  {
    screen: "portfolio",
    label: "Agentes",
    path: "/agentes",
    selo: "JUNTA",
    origem: "Portfólio + Profissional + Admissão",
  },
  {
    screen: "entregas",
    label: "Entregas",
    path: "/entregas",
    selo: "NOVO",
    origem: "não existia",
  },
  {
    screen: "reports",
    label: "Relatórios",
    path: "/relatorios",
    selo: "EVOLUI",
    origem: "Relatórios executivos + Métricas",
  },
  {
    screen: "alerts",
    label: "Pendências",
    path: "/pendencias",
    selo: "EVOLUI",
    origem: "Alertas + fila de decisões",
  },
];

export const SHELL_RODAPE: ShellNavItem = {
  screen: "accountSettings",
  label: "Configurações",
  path: "/configuracoes",
  selo: "JUNTA",
  origem: "Conectores + Governança + Configurações + Perfil + Admin Console",
};

/** Barra inferior do mobile: 4 itens fixos + "Mais". */
export const SHELL_MOBILE: ShellNavItem[] = [
  SHELL_NAV[0],
  SHELL_NAV[1],
  SHELL_NAV[2],
  SHELL_NAV[4],
];

/** Itens do painel "Mais" no mobile. */
export const SHELL_MAIS: ShellNavItem[] = [
  SHELL_NAV[3],
  SHELL_RODAPE,
  {
    screen: "admission",
    label: "Adicionar agente",
    path: "/admissao",
    selo: "JUNTA",
    origem: "Admissão",
  },
  {
    screen: "mapa",
    label: "Mapa do menu",
    path: "/mapa",
    selo: "NOVO",
    origem: "página-mapa",
  },
  { screen: "onboarding", label: "Ajuda e novidades", path: "/guia", selo: "EVOLUI", origem: "Central de adoção" },
  { screen: "profile", label: "Perfil", path: "/perfil", selo: "JUNTA", origem: "Perfil" },
];

export type LinhaMapa = {
  hoje: string;
  rotaHoje?: string;
  destino: string;
  rotaDestino?: string;
  selo: SeloMapa;
  nota?: string;
};

export const MAPA: LinhaMapa[] = [
  { hoje: "Visão gerencial", rotaHoje: "/comando", destino: "Visão geral", rotaDestino: "/comando", selo: "EVOLUI", nota: "os blocos 1 a 5" },
  { hoje: "Relatórios executivos", rotaHoje: "/relatorios", destino: "Relatórios", rotaDestino: "/relatorios", selo: "EVOLUI", nota: "Métricas vira a aba Detalhes" },
  { hoje: "Portfólio", rotaHoje: "/agentes", destino: "Agentes", rotaDestino: "/agentes", selo: "JUNTA" },
  { hoje: "Profissional", rotaHoje: "/agentes/sofia", destino: "Agentes → Prontuário", rotaDestino: "/agentes", selo: "JUNTA" },
  { hoje: "Admissão", rotaHoje: "/admissao", destino: "Agentes → Adicionar agente", rotaDestino: "/admissao", selo: "JUNTA" },
  { hoje: "Métricas", rotaHoje: "/metricas", destino: "Relatórios → Detalhes", rotaDestino: "/relatorios", selo: "JUNTA" },
  { hoje: "Conectores", rotaHoje: "/conectores", destino: "Configurações", rotaDestino: "/configuracoes", selo: "JUNTA" },
  { hoje: "Governança", rotaHoje: "/governanca", destino: "Configurações", rotaDestino: "/configuracoes", selo: "JUNTA" },
  { hoje: "Admin Console", rotaHoje: "/admin", destino: "Configurações (só admin)", rotaDestino: "/configuracoes", selo: "JUNTA" },
  { hoje: "Configurações", rotaHoje: "/configuracoes", destino: "Configurações", rotaDestino: "/configuracoes", selo: "JUNTA" },
  { hoje: "Perfil", rotaHoje: "/perfil", destino: "Configurações", rotaDestino: "/configuracoes", selo: "JUNTA" },
  { hoje: "Alertas", rotaHoje: "/alertas", destino: "Pendências", rotaDestino: "/pendencias", selo: "EVOLUI", nota: "junta a fila de decisões" },
  { hoje: "—", destino: "Entregas", rotaDestino: "/entregas", selo: "NOVO", nota: "lista completa com prova e feedback" },
  { hoje: "Equipes mistas", rotaHoje: "/equipes", destino: "continua acessível pela rota", rotaDestino: "/equipes", selo: "SAI", nota: "some do menu até haver dados" },
  { hoje: "Jornadas A2A", rotaHoje: "/jornadas", destino: "continua acessível pela rota", rotaDestino: "/jornadas", selo: "SAI", nota: "some do menu até haver dados" },
  { hoje: "Benchmarks", rotaHoje: "/benchmarks", destino: "continua acessível pela rota", rotaDestino: "/benchmarks", selo: "SAI", nota: "some do menu até haver dados" },
  { hoje: "Guia / Central de adoção", rotaHoje: "/guia", destino: "Ajuda e novidades", rotaDestino: "/guia", selo: "SAI", nota: "fica fora do menu principal" },
  { hoje: "Seletor de paletas no cabeçalho", destino: "Configurações", rotaDestino: "/configuracoes", selo: "SAI" },
  { hoje: "Control plane do trabalho", destino: "removido", selo: "SAI", nota: "navegação duplicada" },
];

export const SELO_LEGENDA: Record<SeloMapa, string> = {
  NOVO: "não existe hoje",
  SUBSTITUI: "remove o atual e põe outro no lugar",
  EVOLUI: "mesma função, com nova cópia e estrutura",
  JUNTA: "várias telas viram uma",
  SAI: "deixa de ficar visível no menu (a rota continua)",
};

/** Qual item do menu reduzido está ativo para cada tela. */
const ATIVO: Record<WorkforceScreen, WorkforceScreen | null> = {
  today: "today",
  portfolio: "portfolio",
  professional: "portfolio",
  admission: "portfolio",
  connection: "portfolio",
  entregas: "entregas",
  reports: "reports",
  metrics: "reports",
  alerts: "alerts",
  accountSettings: "accountSettings",
  profile: "accountSettings",
  settings: "accountSettings",
  connectors: "accountSettings",
  admin: "accountSettings",
  mapa: "mapa",
  onboarding: null,
  teams: null,
  journeys: null,
  benchmarks: null,
};

/** Selos exibidos no cabeçalho de cada tela. */
const SELOS: Record<WorkforceScreen, Selo | null> = {
  today: "EVOLUI",
  portfolio: "JUNTA",
  professional: "JUNTA",
  admission: "JUNTA",
  connection: "JUNTA",
  entregas: "NOVO",
  reports: "EVOLUI",
  metrics: "JUNTA",
  alerts: "EVOLUI",
  accountSettings: "JUNTA",
  profile: "JUNTA",
  settings: "JUNTA",
  connectors: "JUNTA",
  admin: "JUNTA",
  mapa: "NOVO",
  onboarding: null,
  teams: null,
  journeys: null,
  benchmarks: null,
};

export function shellItemAtivo(screen: WorkforceScreen): ShellNavItem | null {
  const alvo = ATIVO[screen];
  if (!alvo) return null;
  return (
    [...SHELL_NAV, SHELL_RODAPE, ...SHELL_MAIS].find((item) => item.screen === alvo) ?? null
  );
}

export function seloDaTela(screen: WorkforceScreen): Selo | null {
  return SELOS[screen];
}

export function classeSelo(selo: SeloMapa): string {
  if (selo === "NOVO" || selo === "SUBSTITUI") return "border-primary/50 text-primary";
  if (selo === "EVOLUI") return "border-border text-foreground";
  if (selo === "JUNTA") return "border-border text-muted-foreground";
  return "border-dashed border-border text-muted-foreground";
}
