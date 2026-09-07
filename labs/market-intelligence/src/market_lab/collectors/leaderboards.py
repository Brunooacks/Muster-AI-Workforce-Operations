import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from market_lab.collectors.base import (
    CLICKS_RE,
    RANK_RE,
    Collector,
    all_links,
    compact_text,
    external_product_anchors,
    nearest_ranked_card,
    parse_integer,
    parse_number,
    slug_key,
)
from market_lab.models import RawOpportunity


BRL_RE = re.compile(r"R\$\s*([\d.,]+)", re.IGNORECASE)
USD_RE = re.compile(r"(?<!R)\$\s*([\d.,]+)")


def primary_description(card, fallback: str) -> str:
    paragraphs = [
        compact_text(paragraph.get_text(" ", strip=True))
        for paragraph in card.select("p")
    ]
    meaningful = [paragraph for paragraph in paragraphs if len(paragraph) >= 12]
    return max(meaningful, key=len) if meaningful else fallback


def parse_leaderboard(
    html: str,
    *,
    source: str,
    source_url: str,
    price_pattern: re.Pattern[str],
    currency: str,
) -> list[RawOpportunity]:
    soup = BeautifulSoup(html, "html.parser")
    items: list[RawOpportunity] = []
    seen: set[str] = set()
    if source == "melhorlance":
        internal_anchors = [
            (anchor, urljoin(source_url, str(anchor.get("href"))))
            for anchor in soup.select("a[href^='/l/']")
        ]
        product_anchors = internal_anchors or external_product_anchors(soup, source_url)
    else:
        product_anchors = external_product_anchors(soup, source_url)
    for anchor, product_url in product_anchors:
        card = nearest_ranked_card(anchor, price_pattern)
        if card is None:
            continue
        text = compact_text(card.get_text(" ", strip=True))
        description = primary_description(card, text)
        rank_match = RANK_RE.search(text)
        price_match = price_pattern.search(text)
        if not rank_match or not price_match:
            continue
        anchor_label = compact_text(anchor.get_text(" ", strip=True))
        key = (
            slug_key(anchor_label)
            if source == "melhorlance" and anchor_label
            else urlparse(product_url).netloc.removeprefix("www.").lower() or slug_key(product_url)
        )
        if key in seen:
            continue
        seen.add(key)
        click_match = CLICKS_RE.search(text)
        category_anchor = card.select_one("a[href*='/category/']")
        category = compact_text(category_anchor.get_text(" ", strip=True)) if category_anchor else None
        title = anchor_label
        if not title or title.lower() in {"image", "see details"}:
            title = key
        items.append(
            RawOpportunity(
                source=source,
                external_key=key,
                title=title[:240],
                description=description[:1800],
                url=product_url,
                rank=int(rank_match.group(1)),
                paid_value=parse_number(price_match.group(1)),
                currency=currency,
                clicks=parse_integer(click_match.group(1)) if click_match else None,
                category=category,
                links=all_links(card, source_url),
                metadata={"card_text": text, "link_count": len(all_links(card, source_url))},
            )
        )
    return sorted(items, key=lambda item: item.rank or 999999)


class MelhorLanceCollector(Collector):
    source_url = "https://www.melhorlance.dev/"

    @property
    def source_name(self) -> str:
        return "melhorlance"

    def parse(self, html: str) -> list[RawOpportunity]:
        return parse_leaderboard(
            html,
            source=self.source_name,
            source_url=self.source_url,
            price_pattern=BRL_RE,
            currency="BRL",
        )


class OutbidCollector(Collector):
    source_url = "https://outbid.lol/"

    @property
    def source_name(self) -> str:
        return "outbid"

    def parse(self, html: str) -> list[RawOpportunity]:
        return parse_leaderboard(
            html,
            source=self.source_name,
            source_url=self.source_url,
            price_pattern=USD_RE,
            currency="USD",
        )
