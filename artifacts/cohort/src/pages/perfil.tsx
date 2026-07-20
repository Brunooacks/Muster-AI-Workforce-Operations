import { useState } from "react";
import { useUser } from "@clerk/react";
import { Link } from "wouter";
import { Briefcase, Terminal } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeading, Eyebrow, AgentDisc, Pill } from "@/components/cohort";
import { useAppShell } from "@/lib/app-shell";
import { useListAgents } from "@workspace/api-client-react";
import { platformLabel } from "@/lib/platforms";
import { useLang, localeOf, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ── Dicionário da página (pt canônico · en · es) ─────────── */

const PT = {
  bcAccount: "Conta",
  bcProfile: "Perfil",
  eyebrow: "Conta · Perfil",
  title: "Seu perfil",
  subtitle: "Seus dados pessoais, preferências de visualização e os agentes que você acompanha.",
  userFallback: "Usuário",
  fieldFirstName: "Nome",
  fieldLastName: "Sobrenome",
  fieldEmail: "E-mail",
  fieldMemberSince: "Membro desde",
  prefsTitle: "Preferências de visualização",
  vocabLabel: "Vocabulário padrão",
  vocabDesc: "Como o Muster fala com você",
  vocabGestor: "Gestor",
  vocabPlatform: "Platform",
  themeLabel: "Tema",
  themeDesc: "Light editorial ou dark mode",
  themeLight: "Light editorial",
  themeDark: "Dark",
  themeAuto: "Automático",
  langLabel: "Idioma",
  langDesc: "Idioma da interface",
  followTitle: "Agentes que você acompanha",
  followEmpty: "Você ainda não acompanha nenhum agente. Admita agentes para começar.",
};

type Dict = typeof PT;

const L: Record<Lang, Dict> = {
  pt: PT,
  en: {
    bcAccount: "Account",
    bcProfile: "Profile",
    eyebrow: "Account · Profile",
    title: "Your profile",
    subtitle: "Your personal details, display preferences and the agents you follow.",
    userFallback: "User",
    fieldFirstName: "First name",
    fieldLastName: "Last name",
    fieldEmail: "E-mail",
    fieldMemberSince: "Member since",
    prefsTitle: "Display preferences",
    vocabLabel: "Default vocabulary",
    vocabDesc: "How Muster speaks to you",
    vocabGestor: "Manager",
    vocabPlatform: "Platform",
    themeLabel: "Theme",
    themeDesc: "Light editorial or dark mode",
    themeLight: "Light editorial",
    themeDark: "Dark",
    themeAuto: "Automatic",
    langLabel: "Language",
    langDesc: "Interface language",
    followTitle: "Agents you follow",
    followEmpty: "You don't follow any agents yet. Admit agents to get started.",
  },
  es: {
    bcAccount: "Cuenta",
    bcProfile: "Perfil",
    eyebrow: "Cuenta · Perfil",
    title: "Tu perfil",
    subtitle: "Tus datos personales, preferencias de visualización y los agentes que sigues.",
    userFallback: "Usuario",
    fieldFirstName: "Nombre",
    fieldLastName: "Apellido",
    fieldEmail: "Correo electrónico",
    fieldMemberSince: "Miembro desde",
    prefsTitle: "Preferencias de visualización",
    vocabLabel: "Vocabulario predeterminado",
    vocabDesc: "Cómo te habla Muster",
    vocabGestor: "Gestor",
    vocabPlatform: "Platform",
    themeLabel: "Tema",
    themeDesc: "Light editorial o modo oscuro",
    themeLight: "Light editorial",
    themeDark: "Dark",
    themeAuto: "Automático",
    langLabel: "Idioma",
    langDesc: "Idioma de la interfaz",
    followTitle: "Agentes que sigues",
    followEmpty: "Aún no sigues ningún agente. Admite agentes para comenzar.",
  },
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <Eyebrow className="mb-1 block">{label}</Eyebrow>
      <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">
        {value || "—"}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { perspective, setPerspective } = useAppShell();
  const { data: agents, isLoading } = useListAgents();
  const { lang } = useLang();
  const t = L[lang];
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("pt-BR");

  const followed = (agents ?? []).slice(0, 4);

  return (
    <AppLayout breadcrumbs={[{ label: t.bcAccount }, { label: t.bcProfile }]}>
      <div className="mx-auto max-w-3xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
        />

        {/* Identidade */}
        <Card className="p-6">
          {!isLoaded ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-4">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.fullName ?? "Avatar"}
                    className="h-16 w-16 rounded-full border border-border object-cover"
                  />
                ) : (
                  <AgentDisc name={user?.fullName ?? t.userFallback} size="lg" />
                )}
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">
                    {user?.fullName || t.userFallback}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.fieldFirstName} value={user?.firstName} />
                <Field label={t.fieldLastName} value={user?.lastName} />
                <Field label={t.fieldEmail} value={user?.primaryEmailAddress?.emailAddress} />
                <Field
                  label={t.fieldMemberSince}
                  value={
                    user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString(localeOf(lang))
                      : undefined
                  }
                />
              </div>
            </>
          )}
        </Card>

        {/* Preferências de visualização */}
        <Card className="p-6">
          <h3 className="mb-4 font-serif text-lg font-medium tracking-tight text-foreground">
            {t.prefsTitle}
          </h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 border-b border-card-border py-3">
              <div>
                <div className="text-sm font-medium text-foreground">{t.vocabLabel}</div>
                <div className="text-xs text-muted-foreground">{t.vocabDesc}</div>
              </div>
              <div className="flex items-center rounded-full border border-border bg-card p-0.5">
                {(
                  [
                    { value: "gestor", label: t.vocabGestor, icon: Briefcase },
                    { value: "platform", label: t.vocabPlatform, icon: Terminal },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPerspective(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      perspective === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-card-border py-3">
              <div>
                <div className="text-sm font-medium text-foreground">{t.themeLabel}</div>
                <div className="text-xs text-muted-foreground">{t.themeDesc}</div>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t.themeLight}</SelectItem>
                  <SelectItem value="dark">{t.themeDark}</SelectItem>
                  <SelectItem value="auto">{t.themeAuto}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-sm font-medium text-foreground">{t.langLabel}</div>
                <div className="text-xs text-muted-foreground">{t.langDesc}</div>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es-ES">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Agentes que acompanha */}
        <Card className="p-6">
          <h3 className="mb-4 font-serif text-lg font-medium tracking-tight text-foreground">
            {t.followTitle}
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : followed.length > 0 ? (
            <div className="space-y-1">
              {followed.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agentes/${agent.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border-b border-card-border px-1 py-2.5 transition-colors last:border-0 hover:bg-secondary/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AgentDisc name={agent.name} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {agent.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{agent.role}</div>
                    </div>
                  </div>
                  <Pill tone="muted">{platformLabel(agent.platform)}</Pill>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.followEmpty}
            </p>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
