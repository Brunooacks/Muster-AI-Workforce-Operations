import type { Lang } from "./i18n";

/**
 * Linguagem corporativa da área logada: a primeira camada de cada tela usa
 * termos de gestão. O termo técnico só aparece no ícone "i", para quem quiser
 * o detalhe. Muster trata de direcionar atividades triviais e repetitivas para
 * agentes — nunca de substituir pessoas.
 */
export const GLOSSARY: Record<string, Record<Lang, string>> = {
  trace: { pt: "registro", en: "record", es: "registro" },
  tokens: { pt: "consumo", en: "usage", es: "consumo" },
  prompt: { pt: "instrução", en: "instruction", es: "instrucción" },
  a2a: { pt: "processo entre agentes", en: "agent-to-agent process", es: "proceso entre agentes" },
  llm: { pt: "IA", en: "AI", es: "IA" },
  "fast-model": { pt: "IA rápida", en: "fast AI", es: "IA rápida" },
  "advanced-model": { pt: "IA avançada", en: "advanced AI", es: "IA avanzada" },
  shutdown: { pt: "devolver para a equipe", en: "return to the team", es: "devolver al equipo" },
};

/** Termos que não podem aparecer na primeira camada (título, KPI, botão). */
export const FIRST_LAYER_BANNED: RegExp[] = [
  /\btokens?\b/i,
  /\bprompts?\b/i,
  /\btraces?\b/i,
  /\bA2A\b/,
  /\bLLMs?\b/i,
  /\bembeddings?\b/i,
  /\bsubstitui(r|ção)\b/i,
  /\breplace(ment)?\b/i,
  /\breemplaz(ar|o)\b/i,
  /\bdesligar\b/i,
];

export function findJargon(text: string): string[] {
  return FIRST_LAYER_BANNED.filter((re) => re.test(text)).map((re) => re.source);
}

export function term(key: keyof typeof GLOSSARY, lang: Lang): string {
  return GLOSSARY[key]![lang];
}
