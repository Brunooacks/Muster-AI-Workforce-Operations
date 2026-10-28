import { Badge } from "@/components/ui/badge";
import { useLang, type Lang } from "@/lib/i18n";

const CONNECTORS = [
  { name: "Zendesk", soon: true },
  { name: "Salesforce", soon: true },
  { name: "HubSpot", soon: true },
  { name: "Snowflake", soon: true },
  { name: "Notion AI", soon: false },
  { name: "Kubernetes", soon: false },
  { name: "Docker", soon: false },
  { name: "vLLM", soon: false },
  { name: "AWS", soon: false },
  { name: "Azure", soon: false },
  { name: "GCP", soon: false },
  { name: "On-premise", soon: false },
];

const pt = {
  h3: "Funciona onde seus agentes já estão.",
  note: "Na nuvem ou no seu servidor · dados isolados por empresa · tudo auditável",
  soon: "Em breve",
};

const en: typeof pt = {
  h3: "Works where your agents already are.",
  note: "In the cloud or on your own server · data isolated per company · fully auditable",
  soon: "Coming soon",
};
const es: typeof pt = {
  h3: "Funciona donde sus agentes ya están.",
  note: "En la nube o en su servidor · datos aislados por empresa · todo auditable",
  soon: "Próximamente",
};

const copy: Record<Lang, typeof pt> = { pt, en, es };

export function HomeIntegracoes() {
  const { lang } = useLang();
  const t = copy[lang] ?? copy.pt;

  return (
    <section
      id="integracoes"
      className="mx-auto flex max-w-[1280px] scroll-mt-20 flex-col items-center gap-7 px-5 pb-[clamp(64px,10vw,120px)] text-center lg:px-12"
    >
      <h3 className="text-[clamp(22px,3.1vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em]">
        {t.h3}
      </h3>

      <div className="flex max-w-[900px] flex-wrap justify-center gap-2.5">
        {CONNECTORS.filter((c) => !c.soon).map((connector) => (
          <span
            key={connector.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[.12] px-[18px] py-2.5 text-[15px] font-medium text-foreground"
          >
            {connector.name}
            {connector.soon && (
              <Badge variant="soon" className="border-0 px-1 py-0">
                {t.soon}
              </Badge>
            )}
          </span>
        ))}
      </div>

      <p className="text-[15px] text-muted-foreground">{t.note}</p>
    </section>
  );
}
