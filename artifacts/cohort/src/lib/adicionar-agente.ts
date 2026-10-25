/** Regras do formulário "Adicionar agente" (referências §3 · T8). */

export type CampoChave =
  | "nome"
  | "funcao"
  | "plataforma"
  | "responsavel"
  | "entregaPronta"
  | "comoConfirma"
  | "orcamento"
  | "naoPode"
  | "chamaHumano";

export type TipoCampo = "texto" | "area" | "selecao" | "moeda";

export type CampoEtapa = {
  chave: CampoChave;
  rotulo: string;
  obrigatorio: boolean;
  tipo: TipoCampo;
  ajuda?: string;
};

export type EtapaAdicionarAgente = {
  id: string;
  numero: number;
  titulo: string;
  campos: CampoEtapa[];
};

export type FormAdicionarAgente = Record<CampoChave, string>;

export const FORM_VAZIO: FormAdicionarAgente = {
  nome: "",
  funcao: "",
  plataforma: "",
  responsavel: "",
  entregaPronta: "",
  comoConfirma: "",
  orcamento: "",
  naoPode: "",
  chamaHumano: "",
};

export const ETAPAS: EtapaAdicionarAgente[] = [
  {
    id: "quem-e",
    numero: 1,
    titulo: "1. Quem é",
    campos: [
      { chave: "nome", rotulo: "Nome do agente", obrigatorio: true, tipo: "texto", ajuda: "Ex.: Sofia" },
      { chave: "funcao", rotulo: "O que ele faz (1 frase)", obrigatorio: true, tipo: "texto", ajuda: "Ex.: Resolve tickets de primeira resposta" },
      { chave: "plataforma", rotulo: "Plataforma", obrigatorio: true, tipo: "selecao" },
      { chave: "responsavel", rotulo: "Responsável (pode definir depois)", obrigatorio: false, tipo: "texto" },
    ],
  },
  {
    id: "o-que-entrega",
    numero: 2,
    titulo: "2. O que entrega",
    campos: [
      { chave: "entregaPronta", rotulo: "Que entrega conta como pronta?", obrigatorio: true, tipo: "area", ajuda: "Uma frase que qualquer pessoa entenda." },
      { chave: "comoConfirma", rotulo: "Como você confirma que ficou boa?", obrigatorio: false, tipo: "area", ajuda: "Ex.: prova na origem e nota de quem recebeu." },
    ],
  },
  {
    id: "limites",
    numero: 3,
    titulo: "3. Limites e orçamento",
    campos: [
      { chave: "orcamento", rotulo: "Orçamento mensal (R$)", obrigatorio: true, tipo: "moeda", ajuda: "Quanto o agente pode gastar no período." },
      { chave: "naoPode", rotulo: "O que o agente não pode fazer", obrigatorio: false, tipo: "area" },
      { chave: "chamaHumano", rotulo: "Quando chama um humano", obrigatorio: false, tipo: "area" },
    ],
  },
  { id: "conectar", numero: 4, titulo: "4. Conectar", campos: [] },
];

export function etapaPorId(id: string): EtapaAdicionarAgente {
  return ETAPAS.find((etapa) => etapa.id === id) ?? ETAPAS[0]!;
}

/** Campos obrigatórios ainda vazios, na ordem em que aparecem na tela. */
export function faltantes(form: FormAdicionarAgente, etapa: EtapaAdicionarAgente): CampoEtapa[] {
  return etapa.campos.filter(
    (campo) => campo.obrigatorio && !form[campo.chave]?.trim(),
  );
}

/** Orçamento aceita "96", "96,00" e "R$ 96,00". */
export function orcamentoValido(valor: string): boolean {
  const limpo = valor.trim().replace(/^R\$\s*/i, "").replace(/\./g, "").replace(",", ".");
  if (!limpo) return false;
  return /^\d+(\.\d{1,2})?$/.test(limpo);
}

/** Motulo que o botao mostra quando algo falta, ou null quando a etapa passa. */
export function problemaDaEtapa(
  form: FormAdicionarAgente,
  etapa: EtapaAdicionarAgente,
): string | null {
  const vazios = faltantes(form, etapa);
  if (vazios.length > 0) {
    return `Falta preencher: ${vazios.map((campo) => campo.rotulo).join(", ")}`;
  }
  const orcamento = etapa.campos.find((campo) => campo.chave === "orcamento");
  if (orcamento && !orcamentoValido(form.orcamento)) {
    return "Orçamento mensal (R$) precisa ser um número, como 96,00";
  }
  return null;
}

/** Etapas concluídas, para o indicador "Etapa {n} de 4". */
export function etapasConcluidas(form: FormAdicionarAgente, ate: number): number {
  return ETAPAS.filter(
    (etapa) => etapa.numero < ate && problemaDaEtapa(form, etapa) === null,
  ).length;
}

export function progressoEtapa(numero: number): string {
  return `Etapa ${numero} de ${ETAPAS.length}`;
}
