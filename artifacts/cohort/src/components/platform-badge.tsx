import type { ComponentType } from "react";
import { Database, Plug, Server, Sparkles, Users, Workflow } from "lucide-react";
import { FaAws, FaMicrosoft } from "react-icons/fa6";
import {
  SiDocker,
  SiConfluence,
  SiGithub,
  SiGooglecloud,
  SiJira,
  SiKubernetes,
  SiLangchain,
  SiLinear,
  SiOpenai,
  SiOpentelemetry,
  SiSalesforce,
  SiSentry,
  SiZendesk,
} from "react-icons/si";
import { cn } from "@/lib/utils";

type BrandIcon = ComponentType<{ className?: string }>;

type PlatformDefinition = {
  label: string;
  icon: BrandIcon;
  foreground: string;
  background: string;
};

const platforms: Record<string, PlatformDefinition> = {
  github: { label: "GitHub", icon: SiGithub, foreground: "#f5f7fb", background: "#24292f" },
  "github-copilot": { label: "GitHub Copilot", icon: SiGithub, foreground: "#f5f7fb", background: "#24292f" },
  zendesk: { label: "Zendesk", icon: SiZendesk, foreground: "#ffffff", background: "#03363d" },
  "zendesk-ai": { label: "Zendesk AI", icon: SiZendesk, foreground: "#ffffff", background: "#03363d" },
  salesforce: { label: "Salesforce", icon: SiSalesforce, foreground: "#ffffff", background: "#0d9dda" },
  "salesforce-agentforce": { label: "Salesforce Agentforce", icon: SiSalesforce, foreground: "#ffffff", background: "#0d9dda" },
  openai: { label: "OpenAI", icon: SiOpenai, foreground: "#ffffff", background: "#0f8f72" },
  "openai-assistants": { label: "OpenAI Assistants", icon: SiOpenai, foreground: "#ffffff", background: "#0f8f72" },
  aws: { label: "AWS", icon: FaAws, foreground: "#172033", background: "#ffb11b" },
  "aws-bedrock": { label: "AWS Bedrock", icon: FaAws, foreground: "#172033", background: "#ffb11b" },
  azure: { label: "Microsoft Azure", icon: FaMicrosoft, foreground: "#ffffff", background: "#0078d4" },
  "azure-ai-foundry": { label: "Azure AI Foundry", icon: FaMicrosoft, foreground: "#ffffff", background: "#0078d4" },
  gcp: { label: "Google Cloud", icon: SiGooglecloud, foreground: "#ffffff", background: "#4285f4" },
  "google-vertex-ai": { label: "Google Vertex AI", icon: SiGooglecloud, foreground: "#ffffff", background: "#4285f4" },
  kubernetes: { label: "Kubernetes", icon: SiKubernetes, foreground: "#ffffff", background: "#326ce5" },
  docker: { label: "Docker", icon: SiDocker, foreground: "#ffffff", background: "#2496ed" },
  vllm: { label: "vLLM", icon: Server, foreground: "#f6f2ff", background: "#6d4aff" },
  langgraph: { label: "LangGraph", icon: SiLangchain, foreground: "#ffffff", background: "#1c3c3c" },
  langchain: { label: "LangChain", icon: SiLangchain, foreground: "#ffffff", background: "#1c3c3c" },
  opentelemetry: { label: "OpenTelemetry", icon: SiOpentelemetry, foreground: "#ffffff", background: "#425cc7" },
  sentry: { label: "Sentry", icon: SiSentry, foreground: "#ffffff", background: "#362d59" },
  linear: { label: "Linear", icon: SiLinear, foreground: "#ffffff", background: "#5e6ad2" },
  jira: { label: "Jira", icon: SiJira, foreground: "#ffffff", background: "#1868db" },
  confluence: { label: "Confluence", icon: SiConfluence, foreground: "#ffffff", background: "#1868db" },
  hris: { label: "HRIS", icon: Users, foreground: "#14382e", background: "#8ed6b8" },
  erp: { label: "ERP", icon: Database, foreground: "#3d2700", background: "#f2b94b" },
  "muster-api": { label: "Muster API", icon: Sparkles, foreground: "#152008", background: "#c7f36d" },
  workflow: { label: "Workflow", icon: Workflow, foreground: "#f5f7fb", background: "#526179" },
};

function definitionFor(platform: string): PlatformDefinition {
  return platforms[platform] ?? { label: platform, icon: Plug, foreground: "var(--wo-text)", background: "var(--wo-card-2)" };
}

export function platformIdsFromSource(source: string): string[] {
  const normalized = source.toLowerCase();
  const matches: string[] = [];
  const aliases: Array<[string, string]> = [
    ["github", "github"],
    ["linear", "linear"],
    ["jira", "jira"],
    ["confluence", "confluence"],
    ["sentry", "sentry"],
    ["opentelemetry", "opentelemetry"],
    ["zendesk", "zendesk"],
    ["salesforce", "salesforce"],
    ["openai", "openai"],
    ["aws", "aws"],
    ["azure", "azure"],
    ["google", "gcp"],
    ["kubernetes", "kubernetes"],
    ["docker", "docker"],
    ["vllm", "vllm"],
    ["langgraph", "langgraph"],
    ["hris", "hris"],
    ["erp", "erp"],
    ["muster", "muster-api"],
  ];
  aliases.forEach(([alias, platform]) => {
    if (normalized.includes(alias) && !matches.includes(platform)) matches.push(platform);
  });
  return matches;
}

export function PlatformIcon({ platform, size = "md", className }: { platform: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const definition = definitionFor(platform);
  const Icon = definition.icon;
  return (
    <span
      title={definition.label}
      aria-label={definition.label}
      className={cn("inline-grid shrink-0 place-items-center rounded-lg border border-white/10 shadow-sm ring-1 ring-black/5 transition-transform hover:-translate-y-0.5", size === "sm" ? "h-6 w-6 rounded-md" : size === "lg" ? "h-10 w-10 rounded-xl" : "h-8 w-8", className)}
      style={{ color: definition.foreground, background: definition.background }}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
    </span>
  );
}

export function PlatformBadge({ platform, detail, compact = false, surface = "app" }: { platform: string; detail?: string; compact?: boolean; surface?: "app" | "workforce" }) {
  const definition = definitionFor(platform);
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-lg border py-1 pl-1 pr-2.5", surface === "workforce" ? "border-[var(--wo-line)] bg-[var(--wo-card-2)]" : "border-border bg-secondary/60")}>
      <PlatformIcon platform={platform} size="sm" />
      <span className="min-w-0"><strong className={cn("block truncate text-[9px] font-medium", surface === "workforce" ? "text-[var(--wo-text)]" : "text-foreground")}>{definition.label}</strong>{detail && !compact && <span className={cn("mt-0.5 block truncate text-[8px]", surface === "workforce" ? "text-[var(--wo-muted)]" : "text-muted-foreground")}>{detail}</span>}</span>
    </span>
  );
}

export function PlatformStack({ platforms: platformIds, compact = false }: { platforms: string[]; compact?: boolean }) {
  const uniquePlatforms = [...new Set(platformIds)];
  if (uniquePlatforms.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex items-center">{uniquePlatforms.slice(0, 4).map((platform, index) => <PlatformIcon key={platform} platform={platform} size="sm" className={index > 0 ? "-ml-1.5" : undefined} />)}</span>
      {!compact && <span className="text-[9px] text-[var(--wo-muted)]">{uniquePlatforms.slice(0, 2).map((platform) => definitionFor(platform).label).join(" + ")}{uniquePlatforms.length > 2 ? ` +${uniquePlatforms.length - 2}` : ""}</span>}
    </span>
  );
}
