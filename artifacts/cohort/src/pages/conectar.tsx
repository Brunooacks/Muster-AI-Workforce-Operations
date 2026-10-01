import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Check, Copy, ArrowRight, Loader2, KeyRound, Terminal, Radio } from "lucide-react";
import {
  useGetAgent,
  useCreateAgentApiKey,
  useGetAgentTelemetry,
  getGetAgentTelemetryQueryKey,
} from "@workspace/api-client-react";
import { OperationalPageFrame } from "@/components/layout";
import { PageHeading, Eyebrow } from "@/components/cohort";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang, type Lang } from "@/lib/i18n";

/**
 * Ligar a telemetria — o passo que faltava.
 *
 * Cadastrar um agente sem ligar a coleta produz uma ficha muda: a plataforma
 * mostra a carteira de trabalho e se recusa a dar nota, corretamente, porque
 * não há evidência. O problema é que até aqui o cadastro terminava exatamente
 * assim, sem dizer o que fazer em seguida — e um produto que exige um segundo
 * passo tem obrigação de conduzir esse passo.
 *
 * Esta tela fecha o laço em três movimentos: emite a credencial, entrega o
 * trecho pronto para colar, e fica esperando o primeiro evento chegar. O
 * terceiro é o que importa: a confirmação é observada, não prometida.
 */

/* ── Dicionário (pt canônico · en · es) ─────────────────────── */

interface Dict {
  breadcrumb: string;
  eyebrow: string;
  title: (nome: string) => string;
  subtitle: string;
  stepKey: string;
  stepKeyHelp: string;
  issue: string;
  issuing: string;
  keyOnce: string;
  copy: string;
  copied: string;
  stepCode: string;
  stepCodeHelp: string;
  stepWait: string;
  waiting: string;
  waitingHelp: string;
  arrived: string;
  arrivedHelp: (n: number) => string;
  seeAgent: string;
  alreadyLive: string;
  alreadyLiveHelp: (n: number) => string;
  issueAnother: string;
  cloudTitle: string;
  cloudHelp: string;
  localTitle: string;
  localHelp: string;
  keyFirst: string;
}

const PT: Dict = {
  breadcrumb: "Ligar telemetria",
  eyebrow: "INTEGRAÇÃO",
  title: (nome) => `Ligar a telemetria de ${nome}`,
  subtitle:
    "Sem evidência, a plataforma não dá nota. São três passos e o último acontece sozinho.",
  stepKey: "A credencial deste agente",
  stepKeyHelp:
    "Vale só para ele: uma credencial do agente A não consegue reportar pelo agente B. Aparece uma única vez.",
  issue: "Emitir credencial",
  issuing: "Emitindo…",
  keyOnce: "Copie agora. O servidor guarda só o resumo criptográfico — não dá para recuperar depois.",
  copy: "Copiar",
  copied: "Copiado",
  stepCode: "O que colar no agente",
  stepCodeHelp: "Escolha a linguagem. Os valores já vêm preenchidos.",
  stepWait: "O primeiro evento",
  waiting: "Aguardando o primeiro evento…",
  waitingHelp: "Esta tela verifica sozinha a cada 5 segundos. Deixe-a aberta e rode seu agente.",
  arrived: "Telemetria recebida",
  arrivedHelp: (n) => `${n} ${n === 1 ? "execução registrada" : "execuções registradas"}. A avaliação já pode ser calculada.`,
  seeAgent: "Ver o agente avaliado",
  alreadyLive: "Este agente já reporta telemetria",
  alreadyLiveHelp: (n) => `${n} ${n === 1 ? "execução registrada" : "execuções registradas"}. Emita uma nova credencial apenas se precisar substituir a atual.`,
  issueAnother: "Emitir outra credencial",
  cloudTitle: "O agente roda em nuvem e você não pode mexer no código?",
  cloudHelp:
    "Azure, AWS e Google gravam o rastro de execução por conta própria. A ponte de coleta lê esse rastro e traz para cá, sem tocar no agente.",
  localTitle: "O agente roda dentro da empresa?",
  localHelp:
    "Servidor vLLM local publica métricas por conta própria. A ponte lê esse endereço, sem sidecar e sem abrir porta para fora.",
  keyFirst: "Emita a credencial acima para ver o código com os valores preenchidos.",
};

const EN: Dict = {
  breadcrumb: "Connect telemetry",
  eyebrow: "INTEGRATION",
  title: (nome) => `Connect telemetry for ${nome}`,
  subtitle: "Without evidence the platform won't score. Three steps, and the last one happens on its own.",
  stepKey: "This agent's credential",
  stepKeyHelp:
    "Scoped to this agent only: a credential for agent A cannot report for agent B. Shown once.",
  issue: "Issue credential",
  issuing: "Issuing…",
  keyOnce: "Copy it now. The server keeps only the hash — it cannot be recovered.",
  copy: "Copy",
  copied: "Copied",
  stepCode: "What to paste into the agent",
  stepCodeHelp: "Pick a language. The values are already filled in.",
  stepWait: "The first event",
  waiting: "Waiting for the first event…",
  waitingHelp: "This screen checks every 5 seconds. Leave it open and run your agent.",
  arrived: "Telemetry received",
  arrivedHelp: (n) => `${n} ${n === 1 ? "execution recorded" : "executions recorded"}. The evaluation can now be computed.`,
  seeAgent: "See the evaluated agent",
  alreadyLive: "This agent already reports telemetry",
  alreadyLiveHelp: (n) => `${n} ${n === 1 ? "execution recorded" : "executions recorded"}. Issue a new credential only to replace the current one.`,
  issueAnother: "Issue another credential",
  cloudTitle: "Agent runs in the cloud and you can't touch the code?",
  cloudHelp:
    "Azure, AWS and Google already record the execution trail. The collection bridge reads it and brings it here, without touching the agent.",
  localTitle: "Agent runs inside the company?",
  localHelp:
    "A local vLLM server publishes metrics on its own. The bridge reads that endpoint — no sidecar, no outbound port.",
  keyFirst: "Issue the credential above to see the code with values filled in.",
};

const ES: Dict = {
  breadcrumb: "Conectar telemetría",
  eyebrow: "INTEGRACIÓN",
  title: (nome) => `Conectar la telemetría de ${nome}`,
  subtitle: "Sin evidencia la plataforma no califica. Son tres pasos y el último ocurre solo.",
  stepKey: "La credencial de este agente",
  stepKeyHelp:
    "Vale solo para él: una credencial del agente A no puede reportar por el agente B. Se muestra una sola vez.",
  issue: "Emitir credencial",
  issuing: "Emitiendo…",
  keyOnce: "Cópiala ahora. El servidor guarda solo el resumen criptográfico — no se puede recuperar.",
  copy: "Copiar",
  copied: "Copiado",
  stepCode: "Qué pegar en el agente",
  stepCodeHelp: "Elige el lenguaje. Los valores ya vienen completos.",
  stepWait: "El primer evento",
  waiting: "Esperando el primer evento…",
  waitingHelp: "Esta pantalla verifica sola cada 5 segundos. Déjala abierta y ejecuta tu agente.",
  arrived: "Telemetría recibida",
  arrivedHelp: (n) => `${n} ${n === 1 ? "ejecución registrada" : "ejecuciones registradas"}. Ya se puede calcular la evaluación.`,
  seeAgent: "Ver el agente evaluado",
  alreadyLive: "Este agente ya reporta telemetría",
  alreadyLiveHelp: (n) => `${n} ${n === 1 ? "ejecución registrada" : "ejecuciones registradas"}. Emite una nueva credencial solo si necesitas reemplazar la actual.`,
  issueAnother: "Emitir otra credencial",
  cloudTitle: "¿El agente corre en la nube y no puedes tocar el código?",
  cloudHelp:
    "Azure, AWS y Google ya registran el rastro de ejecución. El puente de recolección lo lee y lo trae aquí, sin tocar el agente.",
  localTitle: "¿El agente corre dentro de la empresa?",
  localHelp:
    "Un servidor vLLM local publica métricas por su cuenta. El puente lee esa dirección, sin sidecar ni puerto hacia afuera.",
  keyFirst: "Emite la credencial de arriba para ver el código con los valores completos.",
};

const L: Record<Lang, Dict> = { pt: PT, en: EN, es: ES };

/**
 * Endereço que o AGENTE vai chamar — não o da tela.
 *
 * A tela roda no Vite (5173) e fala com a API por proxy, mas o agente do
 * cliente chama a API diretamente. Colar aqui a origem do navegador geraria um
 * trecho que falha silenciosamente na máquina de quem integra.
 */
function apiBaseParaAgente(): string {
  const declarado = import.meta.env.VITE_PUBLIC_API_URL as string | undefined;
  if (declarado) return declarado.replace(/\/+$/, "");
  const { protocol, hostname, port } = window.location;
  // Em desenvolvimento a tela é 5173 e a API 8087; fora disso, mesma origem.
  if (port === "5173") return `${protocol}//${hostname}:8087`;
  return `${protocol}//${window.location.host}`;
}

const PLACEHOLDER = "<COLE_AQUI_A_CREDENCIAL>";

function trechoCurl(base: string, agentId: string, chave: string): string {
  return `curl -X POST ${base}/api/agents/${agentId}/events \\
  -H "Authorization: Bearer ${chave}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "kind": "execution",
    "success": true,
    "durationMs": 1180,
    "costCents": 3,
    "tokensIn": 820,
    "tokensOut": 240
  }'`;
}

function trechoTypeScript(base: string, agentId: string, chave: string): string {
  return `import { createMusterReporter } from "@workspace/telemetry-reporter";

const muster = createMusterReporter({
  baseUrl: "${base}",
  agentId: "${agentId}",
  token: "${chave}",
});

// Envolva a execução do seu agente. Duração, sucesso e erro
// são medidos automaticamente.
await muster.trackExecution(() => meuAgente.run(tarefa));`;
}

function trechoPython(base: string, agentId: string, chave: string): string {
  return `import time, requests

BASE  = "${base}"
AGENT = "${agentId}"
KEY   = "${chave}"

def reportar(sucesso: bool, duracao_ms: int, tokens_in=None, tokens_out=None):
    requests.post(
        f"{BASE}/api/agents/{AGENT}/events",
        headers={"Authorization": f"Bearer {KEY}"},
        json={
            "kind": "execution" if sucesso else "error",
            "success": sucesso,
            "durationMs": duracao_ms,
            "tokensIn": tokens_in,
            "tokensOut": tokens_out,
        },
        timeout=5,
    )

# No seu agente:
inicio = time.time()
try:
    resultado = meu_agente.run(tarefa)
    reportar(True, int((time.time() - inicio) * 1000))
except Exception:
    reportar(False, int((time.time() - inicio) * 1000))
    raise`;
}

function BotaoCopiar({ texto, rotuloCopiar, rotuloCopiado }: { texto: string; rotuloCopiar: string; rotuloCopiado: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => setCopiado(true));
      }}
    >
      {copiado ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {copiado ? rotuloCopiado : rotuloCopiar}
    </Button>
  );
}

/** Numeração do passo — o motivo visual que amarra a sequência. */
function Passo({ n, icone, titulo, ajuda }: { n: number; icone: React.ReactNode; titulo: string; ajuda: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icone}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">0{n}</span>
          <h2 className="font-serif text-lg font-medium text-foreground">{titulo}</h2>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{ajuda}</p>
      </div>
    </div>
  );
}

export default function ConectarPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [, params] = useRoute("/agentes/:id/conectar");
  const [, setLocation] = useLocation();
  const agentId = params?.id ?? "";
  const { lang } = useLang();
  const t = L[lang];

  const { data: detalhe, isLoading } = useGetAgent(agentId);
  const criarChave = useCreateAgentApiKey();
  const [chave, setChave] = useState<string | null>(null);

  // Enquanto a tela espera o primeiro evento, ela precisa perguntar de novo.
  // Depois que ele chega, parar de perguntar: manter o intervalo seria gastar
  // requisição para confirmar algo que já está confirmado.
  const { data: telemetria } = useGetAgentTelemetry(agentId, "30d", {
    query: {
      enabled: !!agentId,
      queryKey: getGetAgentTelemetryQueryKey(agentId, "30d"),
      refetchInterval: 5000,
      // Exceção deliberada à regra global do app, que pausa a atualização
      // quando a aba não está visível para não gastar requisição à toa.
      // Aqui a aba oculta é o caso NORMAL: quem está integrando está no
      // terminal rodando o agente, não olhando para esta tela. Pausar o
      // polling faria a confirmação só aparecer quando a pessoa voltasse —
      // e a promessa da tela é justamente perceber sozinha.
      refetchIntervalInBackground: true,
    },
  });

  const execucoes = telemetria?.totalExecutions ?? 0;
  const temTelemetria = execucoes > 0;

  const base = useMemo(() => apiBaseParaAgente(), []);
  const chaveOuPlaceholder = chave ?? PLACEHOLDER;

  const nome = detalhe?.agent?.name ?? "";

  if (isLoading) {
    return (
      <OperationalPageFrame embedded={embedded} breadcrumbs={[{ label: "Agentes" }, { label: t.breadcrumb }]}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-40 w-full" />
        </div>
      </OperationalPageFrame>
    );
  }

  return (
    <OperationalPageFrame embedded={embedded} breadcrumbs={[{ label: "Agentes" }, { label: nome }, { label: t.breadcrumb }]}>
      <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in duration-500">
        <PageHeading eyebrow={t.eyebrow} title={t.title(nome)} subtitle={t.subtitle} />

        {/* ── 01 · Credencial ─────────────────────────────────── */}
        <Card className="p-6">
          <Passo n={1} icone={<KeyRound className="h-3.5 w-3.5" />} titulo={t.stepKey} ajuda={t.stepKeyHelp} />

          {chave ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-card-border bg-muted/40 p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{chave}</code>
                <BotaoCopiar texto={chave} rotuloCopiar={t.copy} rotuloCopiado={t.copied} />
              </div>
              <p className="text-xs text-muted-foreground">{t.keyOnce}</p>
            </div>
          ) : (
            <Button
              onClick={() =>
                criarChave.mutate(
                  { agentId, data: { label: "integração" } },
                  { onSuccess: (r) => setChave(r.plaintext) },
                )
              }
              disabled={criarChave.isPending}
            >
              {criarChave.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.issuing}</>
              ) : (
                <><KeyRound className="mr-2 h-4 w-4" />{chave === null && temTelemetria ? t.issueAnother : t.issue}</>
              )}
            </Button>
          )}
        </Card>

        {/* ── 02 · Código ─────────────────────────────────────── */}
        <Card className="p-6">
          <Passo n={2} icone={<Terminal className="h-3.5 w-3.5" />} titulo={t.stepCode} ajuda={t.stepCodeHelp} />

          {!chave && <p className="mb-3 text-sm text-muted-foreground">{t.keyFirst}</p>}

          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">REST / curl</TabsTrigger>
              <TabsTrigger value="ts">TypeScript</TabsTrigger>
              <TabsTrigger value="py">Python</TabsTrigger>
            </TabsList>

            {([
              ["curl", trechoCurl(base, agentId, chaveOuPlaceholder)],
              ["ts", trechoTypeScript(base, agentId, chaveOuPlaceholder)],
              ["py", trechoPython(base, agentId, chaveOuPlaceholder)],
            ] as const).map(([valor, codigo]) => (
              <TabsContent key={valor} value={valor} className="mt-3">
                <div className="relative">
                  <pre className="max-h-80 overflow-auto rounded-lg border border-card-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
                    {codigo}
                  </pre>
                  <div className="absolute right-3 top-3">
                    <BotaoCopiar texto={codigo} rotuloCopiar={t.copy} rotuloCopiado={t.copied} />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>

        {/* ── 03 · Espera ativa ───────────────────────────────── */}
        <Card className={temTelemetria ? "border-chart-2/40 p-6" : "p-6"}>
          <Passo n={3} icone={<Radio className="h-3.5 w-3.5" />} titulo={t.stepWait} ajuda="" />

          {temTelemetria ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-chart-2/20">
                  <Check className="h-3.5 w-3.5 text-chart-2" />
                </span>
                <div>
                  <p className="font-medium text-foreground">{t.arrived}</p>
                  <p className="text-sm text-muted-foreground">{t.arrivedHelp(execucoes)}</p>
                </div>
              </div>
              <Button onClick={() => setLocation(`/agentes/${agentId}`)}>
                {t.seeAgent}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">{t.waiting}</p>
                <p className="text-sm text-muted-foreground">{t.waitingHelp}</p>
              </div>
            </div>
          )}
        </Card>

        {/* ── Alternativas, para quem não pode tocar no agente ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { titulo: t.cloudTitle, ajuda: t.cloudHelp },
            { titulo: t.localTitle, ajuda: t.localHelp },
          ].map((alt) => (
            <Card key={alt.titulo} className="bg-muted/20 p-5">
              <Eyebrow>{alt.titulo}</Eyebrow>
              <p className="mt-2 text-sm text-muted-foreground">{alt.ajuda}</p>
            </Card>
          ))}
        </div>

        <div className="pb-4">
          <Link href={`/agentes/${agentId}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← {nome}
          </Link>
        </div>
      </div>
    </OperationalPageFrame>
  );
}
