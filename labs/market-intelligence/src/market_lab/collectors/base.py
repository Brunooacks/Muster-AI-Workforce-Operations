import hashlib
import json
import re
import time
from abc import ABC, abstractmethod
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

from market_lab.config import Settings
from market_lab.models import CollectionResult, RawOpportunity


SPACE_RE = re.compile(r"\s+")
RANK_RE = re.compile(r"#\s*(\d{1,5})")
CLICKS_RE = re.compile(r"([\d.,]+)\s*(?:cliques|clicks)", re.IGNORECASE)
EXCLUDED_HOSTS = {
    "x.com",
    "twitter.com",
    "linkedin.com",
    "instagram.com",
    "facebook.com",
    "himetrica.com",
    "www.himetrica.com",
    "datafa.st",
    "app.vemetric.com",
}


def compact_text(value: str) -> str:
    return SPACE_RE.sub(" ", value).strip()


def parse_number(value: str) -> float:
    clean = value.replace(" ", "")
    if "," in clean and "." in clean:
        if clean.rfind(",") > clean.rfind("."):
            clean = clean.replace(".", "").replace(",", ".")
        else:
            clean = clean.replace(",", "")
    elif "," in clean:
        parts = clean.split(",")
        clean = "".join(parts) if len(parts[-1]) == 3 else clean.replace(",", ".")
    elif "." in clean:
        parts = clean.split(".")
        clean = "".join(parts) if len(parts[-1]) == 3 else clean
    return float(clean)


def parse_integer(value: str) -> int:
    return int(round(parse_number(value)))


def slug_key(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized[:160] or hashlib.sha256(value.encode()).hexdigest()[:24]


def collection_hash(items: list[RawOpportunity]) -> str:
    payload = [
        {
            "source": item.source,
            "external_key": item.external_key,
            "title": item.title,
            "description": item.description,
            "url": item.url,
            "author": item.author,
            "season": item.season,
            "category": item.category,
            "rank": item.rank,
            "paid_value": item.paid_value,
            "currency": item.currency,
            "clicks": item.clicks,
            "links": sorted(item.links),
        }
        for item in sorted(items, key=lambda item: (item.source, item.external_key))
    ]
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def all_links(node: Tag | BeautifulSoup, base_url: str) -> list[str]:
    links: list[str] = []
    for anchor in node.select("a[href]"):
        href = anchor.get("href")
        if not href:
            continue
        absolute = urljoin(base_url, href)
        if absolute.startswith(("http://", "https://")):
            links.append(absolute)
    return list(dict.fromkeys(links))


def external_product_anchors(soup: BeautifulSoup, base_url: str) -> list[tuple[Tag, str]]:
    source_host = urlparse(base_url).netloc.removeprefix("www.")
    anchors: list[tuple[Tag, str]] = []
    seen: set[str] = set()
    for anchor in soup.select("a[href]"):
        absolute = urljoin(base_url, str(anchor.get("href")))
        parsed = urlparse(absolute)
        host = parsed.netloc.removeprefix("www.").lower()
        if not host or host == source_host or host in EXCLUDED_HOSTS:
            continue
        if absolute in seen or parsed.scheme not in {"http", "https"}:
            continue
        seen.add(absolute)
        anchors.append((anchor, absolute))
    return anchors


def nearest_ranked_card(anchor: Tag, price_pattern: re.Pattern[str]) -> Tag | None:
    for parent in anchor.parents:
        if not isinstance(parent, Tag):
            continue
        text = compact_text(parent.get_text(" ", strip=True))
        if len(text) > 3000:
            break
        if RANK_RE.search(text) and price_pattern.search(text):
            return parent
    return None


class Collector(ABC):
    source_url: str

    def __init__(self, settings: Settings):
        self.settings = settings

    def fetch_url(self, url: str) -> tuple[str, int]:
        with httpx.Client(
            follow_redirects=True,
            timeout=self.settings.request_timeout_seconds,
            headers={
                "User-Agent": self.settings.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
                "Cache-Control": "no-cache",
            },
        ) as client:
            for attempt in range(3):
                response = client.get(url)
                if response.status_code != 429 and response.status_code < 500:
                    response.raise_for_status()
                    return response.text, response.status_code
                if attempt < 2:
                    time.sleep(2**attempt)
            response.raise_for_status()
            return response.text, response.status_code

    def fetch(self) -> tuple[str, int]:
        return self.fetch_url(self.source_url)

    def collect(self) -> CollectionResult:
        html, status = self.fetch()
        soup = BeautifulSoup(html, "html.parser")
        items = self.parse(html)[: self.settings.max_items_per_source]
        return CollectionResult(
            source=self.source_name,
            source_url=self.source_url,
            http_status=status,
            page_link_count=len(all_links(soup, self.source_url)),
            source_hash=collection_hash(items),
            items=items,
        )

    @property
    @abstractmethod
    def source_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def parse(self, html: str) -> list[RawOpportunity]:
        raise NotImplementedError
