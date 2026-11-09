import type { Lang } from "@/lib/i18n";

/**
 * Textos das telas de entrar e criar conta. Linguagem corporativa e direta:
 * fala de equipe, rotina e decisão, sem jargão de tecnologia.
 */
/**
 * RG-M08: mínimo de senha configurado na instância Clerk de produção (medido em
 * 31/10/2026: "Your password must contain 15 or more characters"). Se a regra
 * mudar no Clerk, mude aqui.
 */
export const PASSWORD_MIN_LENGTH = 15;

export type AuthCopy = {
  back: string;
  eyebrow: string;
  signInTitle: string;
  signInLead: string;
  signUpTitle: string;
  signUpLead: string;
  points: [string, string, string];
  cardSignInTitle: string;
  cardSignInSubtitle: string;
  cardSignUpTitle: string;
  cardSignUpSubtitle: string;
  github: string;
  google: string;
  or: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  newPasswordPlaceholder: string;
  forgot: string;
  continue: string;
  noAccount: string;
  createAccount: string;
  hasAccount: string;
  signIn: string;
  sameMethod: string;
  /** RG-M08: regra de senha do Clerk, visível antes do envio. */
  passwordRule: string;
  footnote: string;
  themeLight: string;
  themeNight: string;
  terms: string;
};

export const AUTH_COPY: Record<Lang, AuthCopy> = {
  pt: {
    back: "Voltar ao site",
    eyebrow: "Acesso corporativo",
    signInTitle: "Acesse sua operação.",
    signInLead: "Acompanhe as entregas dos agentes, as atividades devolvidas à equipe e os pontos que pedem decisão.",
    signUpTitle: "Crie a conta da sua empresa.",
    signUpLead: "Defina as atividades repetitivas que vão para os agentes e meça o resultado com dados da sua operação.",
    points: ["Atividades repetitivas direcionadas aos agentes", "Decisões sob responsabilidade da equipe", "Indicadores de custo, prazo e qualidade"],
    cardSignInTitle: "Entrar no Muster",
    cardSignInSubtitle: "Entre com o e-mail corporativo ou Google.",
    cardSignUpTitle: "Criar conta",
    cardSignUpSubtitle: "Cadastre-se com o e-mail corporativo ou Google.",
    github: "Continuar com GitHub",
    google: "Continuar com Google",
    or: "ou",
    email: "E-mail corporativo",
    emailPlaceholder: "nome@empresa.com",
    password: "Senha",
    passwordPlaceholder: "Digite sua senha",
    newPasswordPlaceholder: "Crie uma senha",
    forgot: "Esqueci a senha",
    continue: "Continuar",
    noAccount: "Ainda não tem conta?",
    createAccount: "Criar conta",
    hasAccount: "Já tem conta?",
    signIn: "Entrar",
    sameMethod: "Entre do mesmo jeito que criou a conta: com Google ou o seu e-mail.",
    passwordRule: `Senha: mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`,
    footnote: "O login protege o acesso das pessoas. Os agentes usam credenciais próprias, limitadas por empresa e por regra.",
    themeLight: "Claro",
    themeNight: "Noite",
    terms: "Ao continuar, você concorda com os termos de uso e a política de privacidade.",
  },
  en: {
    back: "Back to site",
    eyebrow: "Corporate access",
    signInTitle: "Access your operation.",
    signInLead: "Track agent deliveries, tasks returned to the team and the items that require a decision.",
    signUpTitle: "Create your company account.",
    signUpLead: "Define which repetitive tasks go to agents and measure the results with data from your operation.",
    points: ["Repetitive tasks routed to agents", "Decisions remain with your team", "Cost, lead time and quality metrics"],
    cardSignInTitle: "Sign in to Muster",
    cardSignInSubtitle: "Sign in with your work email or Google.",
    cardSignUpTitle: "Create account",
    cardSignUpSubtitle: "Sign up with your work email or Google.",
    github: "Continue with GitHub",
    google: "Continue with Google",
    or: "or",
    email: "Work email",
    emailPlaceholder: "name@company.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    newPasswordPlaceholder: "Create a password",
    forgot: "Forgot password",
    continue: "Continue",
    noAccount: "Don't have an account?",
    createAccount: "Create account",
    hasAccount: "Already have an account?",
    signIn: "Sign in",
    sameMethod: "Sign in the same way you signed up: with Google or your email.",
    passwordRule: `Password: at least ${PASSWORD_MIN_LENGTH} characters.`,
    footnote: "Sign-in protects people's access. Agents use their own credentials, limited by company and by policy.",
    themeLight: "Light",
    themeNight: "Night",
    terms: "By continuing, you agree to the terms of use and the privacy policy.",
  },
  es: {
    back: "Volver al sitio",
    eyebrow: "Acceso corporativo",
    signInTitle: "Accede a tu operación.",
    signInLead: "Sigue las entregas de los agentes, las actividades devueltas al equipo y los puntos que requieren decisión.",
    signUpTitle: "Crea la cuenta de tu empresa.",
    signUpLead: "Define las actividades repetitivas que pasan a los agentes y mide el resultado con datos de tu operación.",
    points: ["Actividades repetitivas dirigidas a los agentes", "Decisiones bajo responsabilidad del equipo", "Indicadores de costo, plazo y calidad"],
    cardSignInTitle: "Entrar en Muster",
    cardSignInSubtitle: "Entra con el correo corporativo o Google.",
    cardSignUpTitle: "Crear cuenta",
    cardSignUpSubtitle: "Regístrate con el correo corporativo o Google.",
    github: "Continuar con GitHub",
    google: "Continuar con Google",
    or: "o",
    email: "Correo corporativo",
    emailPlaceholder: "nombre@empresa.com",
    password: "Contraseña",
    passwordPlaceholder: "Escribe tu contraseña",
    newPasswordPlaceholder: "Crea una contraseña",
    forgot: "Olvidé la contraseña",
    continue: "Continuar",
    noAccount: "¿Aún no tienes cuenta?",
    createAccount: "Crear cuenta",
    hasAccount: "¿Ya tienes cuenta?",
    signIn: "Entrar",
    sameMethod: "Entra de la misma forma en que creaste la cuenta: con Google o tu correo.",
    passwordRule: `Contraseña: mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`,
    footnote: "El inicio de sesión protege el acceso de las personas. Los agentes usan credenciales propias, limitadas por empresa y por reglas.",
    themeLight: "Claro",
    themeNight: "Noche",
    terms: "Al continuar, aceptas los términos de uso y la política de privacidad.",
  },
};
