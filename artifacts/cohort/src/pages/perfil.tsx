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
import { cn } from "@/lib/utils";

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
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("pt-BR");

  const followed = (agents ?? []).slice(0, 4);

  return (
    <AppLayout breadcrumbs={[{ label: "Conta" }, { label: "Perfil" }]}>
      <div className="mx-auto max-w-3xl space-y-7 animate-in fade-in duration-500">
        <PageHeading
          eyebrow="Conta · Perfil"
          title="Seu perfil"
          subtitle="Seus dados pessoais, preferências de visualização e os agentes que você acompanha."
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
                  <AgentDisc name={user?.fullName ?? "Usuário"} size="lg" />
                )}
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">
                    {user?.fullName || "Usuário"}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome" value={user?.firstName} />
                <Field label="Sobrenome" value={user?.lastName} />
                <Field label="E-mail" value={user?.primaryEmailAddress?.emailAddress} />
                <Field
                  label="Membro desde"
                  value={
                    user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("pt-BR")
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
            Preferências de visualização
          </h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 border-b border-card-border py-3">
              <div>
                <div className="text-sm font-medium text-foreground">Vocabulário padrão</div>
                <div className="text-xs text-muted-foreground">Como o Muster fala com você</div>
              </div>
              <div className="flex items-center rounded-full border border-border bg-card p-0.5">
                {(
                  [
                    { value: "gestor", label: "Gestor", icon: Briefcase },
                    { value: "platform", label: "Platform", icon: Terminal },
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
                <div className="text-sm font-medium text-foreground">Tema</div>
                <div className="text-xs text-muted-foreground">Light editorial ou dark mode</div>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light editorial</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Automático</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-sm font-medium text-foreground">Idioma</div>
                <div className="text-xs text-muted-foreground">Idioma da interface</div>
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
            Agentes que você acompanha
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
              Você ainda não acompanha nenhum agente. Admita agentes para começar.
            </p>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
