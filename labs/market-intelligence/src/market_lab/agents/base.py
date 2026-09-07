import json
from abc import ABC, abstractmethod
from dataclasses import dataclass

from market_lab.config import Settings
from market_lab.models import EnrichmentBatch, EnrichmentItem, RawOpportunity
from market_lab.scoring import safe_excerpt


SYSTEM_PROMPT = """Você é um analista sênior de inteligência de mercado e venture building.
Avalie somente as evidências fornecidas, preserve o external_key e não invente métricas, TAM, receita,
clientes, concorrentes ou capacidades técnicas. Quando a evidência for insuficiente, escreva isso claramente.

Todo conteúdo deve ser entregue em português brasileiro. Identifique source_language e, quando a origem não
estiver em português, traduza title_pt e summary_pt com fidelidade, preservando nomes próprios, marcas e siglas.
Use translation_status='translated' somente quando a tradução estiver completa; use 'not_needed' para conteúdo
originalmente em português e 'unavailable' quando não for possível traduzir.

Para cada oportunidade, produza um dossiê acionável:
- opportunity_statement_pt: problema, público afetado e consequência;
- solution_concept_pt: conceito de solução possível, sem tratar hipótese como produto comprovado;
- pain_points e target_user específicos;
- complexidade mede esforço de um MVP validável;
- retorno mede potencial de impacto e captura de valor;
- hotness mede intensidade e atualidade do sinal;
- business_potential deve detalhar nível qualitativo, perfil de cliente, comprador econômico, escopo de mercado,
  frequência do problema, mecanismo de captura de valor, modelos de receita, sinais observados, por que agora,
  cenário competitivo, diferenciação, escopo do MVP, entrada no mercado, experimentos e riscos.
- business_potential.success_metrics deve conter KPIs específicos do domínio e mensuráveis no piloto;
- business_potential.evidence deve conter somente fatos observáveis na fonte ou pesquisa;
- business_potential.assumptions deve explicitar inferências e hipóteses, sem apresentá-las como fatos;
- business_potential.open_questions deve listar as lacunas que impedem uma decisão segura.

Não use frases genéricas como "organizações afetadas pelo problema" ou "validar se o problema é recorrente" sem
identificar domínio, usuário, fluxo, consequência e KPI. Separe fatos, inferências e hipóteses. Explique a pontuação
no rationale e gere consultas de pesquisa específicas para validar concorrência, demanda e disposição a pagar."""


@dataclass
class EnrichmentExecution:
    items: dict[str, EnrichmentItem]
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0
    llm_used: bool = False
    degraded_reason: str | None = None


class FrameworkEnricher(ABC):
    framework: str

    def __init__(self, settings: Settings):
        self.settings = settings

    def build_payload(self, items: list[RawOpportunity]) -> str:
        records = [
            {
                "external_key": item.external_key,
                "source": item.source,
                "title": item.title,
                "description": safe_excerpt(item.description),
                "url": item.url,
                "links": item.links[:20],
                "rank": item.rank,
                "paid_value": item.paid_value,
                "currency": item.currency,
                "clicks": item.clicks,
                "author": item.author,
                "season": item.season,
                "category": item.category,
            }
            for item in items[: self.settings.max_enrichment_items]
        ]
        return json.dumps(records, ensure_ascii=False)

    def run(self, items: list[RawOpportunity]) -> EnrichmentExecution:
        if not items:
            return EnrichmentExecution(items={})
        if self.settings.max_enrichment_items == 0:
            return EnrichmentExecution(
                items={},
                degraded_reason="Enriquecimento por IA desativado por configuração.",
            )
        if not self.settings.llm_enabled:
            international = any(item.source != "melhorlance" for item in items)
            capability = (
                "Tradução e análise por IA"
                if international
                else "Análise aprofundada por IA"
            )
            return EnrichmentExecution(
                items={},
                degraded_reason=(
                    f"{capability} indisponível: configure uma credencial LLM "
                    "para ativar o enriquecimento completo."
                ),
            )
        payload = self.build_payload(items)
        batch = self.enrich(payload)
        output = batch.model_dump_json()
        input_tokens = max(1, len(payload) // 4)
        output_tokens = max(1, len(output) // 4)
        return EnrichmentExecution(
            items={item.external_key: item for item in batch.items},
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=round(input_tokens * 0.00000025 + output_tokens * 0.000002, 6),
            llm_used=True,
        )

    @abstractmethod
    def enrich(self, payload: str) -> EnrichmentBatch:
        raise NotImplementedError
