import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Plug, Sparkles, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import {
  ETAPAS,
  FORM_VAZIO,
  faltantes,
  problemaDaEtapa,
  progressoEtapa,
  type CampoChave,
  type FormAdicionarAgente,
} from "@/lib/adicionar-agente";

const RESUMO: Array<{ chave: CampoChave; rotulo: string }> = [
  { chave: "nome", rotulo: "Nome do agente" },
  { chave: "funcao", rotulo: "O que ele faz" },
  { chave: "plataforma", rotulo: "Plataforma" },
  { chave: "responsavel", rotulo: "Responsável" },
  { chave: "entregaPronta", rotulo: "Que entrega conta como pronta" },
  { chave: "comoConfirma", rotulo: "Como confirma que ficou boa" },
  { chave: "orcamento", rotulo: "Orçamento mensal (R$)" },
  { chave: "naoPode", rotulo: "O que não pode fazer" },
  { chave: "chamaHumano", rotulo: "Quando chama um humano" },
];

const ORIGENS = [
  { nome: "Zendesk AI", area: "Suporte", detalhe: "Tickets, respostas e provas" },
  { nome: "Salesforce Agentforce", area: "Comercial", detalhe: "Pipeline e oportunidades" },
  { nome: "GitHub Copilot", area: "Engenharia", detalhe: "Pull requests e revisões" },
];

export function AdicionarAgenteScreen() {
  const [, navigate] = useLocation();
  const [indice, setIndice] = useState(0);
  const [form, setForm] = useState<FormAdicionarAgente>(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const etapa = ETAPAS[indice]!;

  const vazios = faltantes(form, etapa);
  const camposComProblema = new Set<string>(
    erro
      ? [
          ...vazios.map((campo) => campo.chave),
          ...(erro.startsWith("Orçamento") ? ["orcamento"] : []),
        ]
      : [],
  );

  function alterar(campo: CampoChave, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErro(null);
  }

  function avancar() {
    const problema = problemaDaEtapa(form, etapa);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    if (indice === ETAPAS.length - 1) {
      navigate("/agentes");
      return;
    }
    setIndice((atual) => atual + 1);
  }

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6 px-4 py-6 lg:px-8" data-testid="adicionar-agente">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--wo-muted)]">
          Operação · novo agente
        </span>
        <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em] text-[var(--wo-text)]">
          Adicionar agente
        </h1>
        <p className="max-w-[720px] text-[15px] leading-[1.5] text-[var(--wo-muted)]">
          Com isso, o Muster sabe o que cobrar do agente e quanto ele pode gastar.
        </p>
      </header>

      <section aria-label="Progresso do cadastro" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--wo-accent)]">
            {progressoEtapa(etapa.numero)} · ~3 min
          </span>
          <span className="text-[11px] text-[var(--wo-muted)]">{etapa.titulo}</span>
        </div>
        <ol className="grid grid-cols-4 gap-2" data-testid="etapas">
          {ETAPAS.map((item) => (
            <li key={item.id} className="flex flex-col gap-2">
              <span
                className={cn(
                  "h-1.5 rounded-full",
                  item.numero <= etapa.numero ? "bg-[var(--wo-accent)]" : "bg-[var(--wo-line)]",
                )}
              />
              <span
                className={cn(
                  "truncate text-[11px]",
                  item.numero === etapa.numero ? "font-medium text-[var(--wo-text)]" : "text-[var(--wo-muted)]",
                )}
              >
                {item.titulo}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-[var(--wo-line)] bg-[var(--wo-card)] p-4 sm:p-6">
        <h2 className="text-lg font-medium text-[var(--wo-text)]">{etapa.titulo}</h2>

        {etapa.campos.length === 0 ? (
          <div className="mt-5 flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              {RESUMO.map((item) => (
                <div key={item.chave} className="rounded-xl bg-[var(--wo-card-2)] p-3">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">{item.rotulo}</dt>
                  <dd className="mt-1 text-[13px] leading-relaxed text-[var(--wo-text)]">
                    {item.chave === "plataforma"
                      ? PLATFORM_LABELS[form.plataforma] ?? "—"
                      : form[item.chave]?.trim() || "—"}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-dashed border-[var(--wo-line)] p-4">
              <p className="text-[13px] font-medium text-[var(--wo-text)]">Conectar a origem dos dados</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--wo-muted)]">
                Sem a origem o agente já entra cadastrado, mas sem entregas, prova ou custo para mostrar.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {ORIGENS.map((origem) => (
                  <li key={origem.nome} className="rounded-xl bg-[var(--wo-card-2)] p-3">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--wo-text)]">
                      <Plug className="h-3.5 w-3.5 text-[var(--wo-muted)]" /> {origem.nome}
                    </span>
                    <span className="mt-1 block text-[11px] text-[var(--wo-muted)]">{origem.area} · {origem.detalhe}</span>
                    <span className="mt-2 inline-block rounded-full border border-[var(--wo-line)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--wo-muted)]">
                      aguardando conexão
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href="/configuracoes"
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--wo-primary)]"
              >
                Abrir Configurações para conectar <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {etapa.campos.map((campo) => {
              const marcado = camposComProblema.has(campo.chave);
              const rotulo = (
                <>
                  {campo.rotulo}
                  {campo.obrigatorio && <span className="ml-1 text-[var(--wo-danger-text)]">*</span>}
                </>
              );
              const classes = cn(
                "w-full rounded-xl border bg-[var(--wo-card-2)] px-3 text-[13px] text-[var(--wo-text)] outline-none transition-colors placeholder:text-[var(--wo-muted)] focus:border-[var(--wo-primary)]",
                marcado ? "border-[var(--wo-danger)]" : "border-[var(--wo-line)]",
              );

              return (
                <label key={campo.chave} className="grid gap-1.5">
                  <span className="text-[12px] font-medium text-[var(--wo-text)]">{rotulo}</span>
                  {campo.tipo === "area" ? (
                    <Textarea
                      rows={3}
                      value={form[campo.chave]}
                      onChange={(event) => alterar(campo.chave, event.target.value)}
                      aria-invalid={marcado || undefined}
                      className={classes}
                    />
                  ) : campo.tipo === "selecao" ? (
                    <select
                      value={form[campo.chave]}
                      onChange={(event) => alterar(campo.chave, event.target.value)}
                      aria-invalid={marcado || undefined}
                      className={cn(classes, "h-10")}
                    >
                      <option value="">Escolha uma plataforma</option>
                      {Object.entries(PLATFORM_LABELS).map(([valor, nome]) => (
                        <option key={valor} value={valor}>{nome}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={form[campo.chave]}
                      onChange={(event) => alterar(campo.chave, event.target.value)}
                      aria-invalid={marcado || undefined}
                      className={cn(classes, campo.tipo === "moeda" && "font-mono")}
                    />
                  )}
                  {campo.ajuda && <span className="text-[11px] text-[var(--wo-muted)]">{campo.ajuda}</span>}
                </label>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--wo-line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0" role="alert" data-testid="falta-preencher">
            {erro ? (
              <p className="text-[12px] font-medium text-[var(--wo-danger-text)]">{erro}</p>
            ) : (
              <p className="text-[11px] text-[var(--wo-muted)]">
                Campos com <span className="text-[var(--wo-danger-text)]">*</span> são obrigatórios.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setErro(null);
                if (indice === 0) navigate("/agentes");
                else setIndice((atual) => atual - 1);
              }}
              className="rounded-xl border border-[var(--wo-line)] bg-[var(--wo-card-2)] text-[var(--wo-text)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {indice === 0 ? "Cancelar" : "Voltar"}
            </Button>
            <Button
              type="button"
              data-testid="avancar-admissao"
              onClick={avancar}
              className="rounded-xl bg-[var(--wo-accent)] text-[13px] font-medium text-[var(--wo-accent-ink)] hover:bg-[var(--wo-accent)]"
            >
              {indice === ETAPAS.length - 1 ? (
                <>
                  <UserPlus className="h-3.5 w-3.5" /> Adicionar agente
                </>
              ) : (
                <>
                  Avançar <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      <p className="flex items-center gap-2 text-[11px] text-[var(--wo-muted)]">
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--wo-accent)]" />
        Ao concluir, o agente aparece em Agentes com a etiqueta de período de experiência até a primeira revisão.
      </p>
    </div>
  );
}
