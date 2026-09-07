import httpx

from market_lab.config import Settings
from market_lab.models import EnrichmentItem, RawOpportunity


class MarketResearch:
    def __init__(self, settings: Settings):
        self.settings = settings

    def search(
        self,
        items: list[RawOpportunity],
        enrichments: dict[str, EnrichmentItem],
    ) -> dict[str, list[dict]]:
        if not self.settings.tavily_api_key or self.settings.max_market_searches == 0:
            return {}
        output: dict[str, list[dict]] = {}
        candidates = items[: self.settings.max_market_searches]
        with httpx.Client(timeout=30) as client:
            for item in candidates:
                enrichment = enrichments.get(item.external_key)
                query = (
                    enrichment.market_search_queries[0]
                    if enrichment and enrichment.market_search_queries
                    else f'"{item.title}" startup competitors'
                )
                response = client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.settings.tavily_api_key,
                        "query": query,
                        "search_depth": "basic",
                        "max_results": 5,
                        "include_answer": False,
                    },
                )
                response.raise_for_status()
                output[item.external_key] = [
                    {
                        "title": result.get("title"),
                        "url": result.get("url"),
                        "content": str(result.get("content", ""))[:600],
                        "score": result.get("score"),
                    }
                    for result in response.json().get("results", [])
                ]
        return output
