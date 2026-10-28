import type { Lang } from "@/lib/i18n";

/** Textos dos componentes-base, nos três idiomas. Uma linha cada. */
export const UI_COPY: Record<Lang, {
  moreInfo: string;
  illustrative: string;
  accountCompany: string;
  accountPersonal: string;
  accountHint: string;
}> = {
  pt: {
    moreInfo: "Mais informações",
    illustrative: "Dados ilustrativos",
    accountCompany: "Conta da empresa",
    accountPersonal: "Conta pessoal",
    accountHint: "A conta pessoal nunca aparece na conta da empresa.",
  },
  en: {
    moreInfo: "More information",
    illustrative: "Illustrative data",
    accountCompany: "Company account",
    accountPersonal: "Personal account",
    accountHint: "Your personal account never appears in the company account.",
  },
  es: {
    moreInfo: "Más información",
    illustrative: "Datos ilustrativos",
    accountCompany: "Cuenta de la empresa",
    accountPersonal: "Cuenta personal",
    accountHint: "La cuenta personal nunca aparece en la de la empresa.",
  },
};
