import json
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from market_lab.collectors.base import (
    Collector,
    all_links,
    collection_hash,
    compact_text,
    slug_key,
)
from market_lab.models import CollectionResult, RawOpportunity


SEASON_RE = re.compile(r"(?:Fall|Summer|Spring|Winter)\s+20\d{2}")
URL_RE = re.compile(r"https?://[^\s<>\"']+")


class YcRfsCollector(Collector):
    source_url = "https://www.ycombinator.com/rfs"

    @property
    def source_name(self) -> str:
        return "yc-rfs"

    def collect(self) -> CollectionResult:
        html, status = self.fetch()
        bundle = self._fetch_rfs_bundle(html)
        items = (self._parse_bundle(bundle) if bundle else self.parse(html))[
            : self.settings.max_items_per_source
        ]
        soup = BeautifulSoup(html, "html.parser")
        discovered_links = set(all_links(soup, self.source_url))
        for item in items:
            discovered_links.update(item.links)
        return CollectionResult(
            source=self.source_name,
            source_url=self.source_url,
            http_status=status,
            page_link_count=len(discovered_links),
            source_hash=collection_hash(items),
            items=items,
        )

    def parse(self, html: str) -> list[RawOpportunity]:
        soup = BeautifulSoup(html, "html.parser")
        items: list[RawOpportunity] = []
        current_season: str | None = None
        for heading in soup.find_all(["h2", "h3"]):
            if heading.name == "h2":
                candidate = compact_text(heading.get_text(" ", strip=True))
                current_season = (
                    candidate
                    if SEASON_RE.fullmatch(candidate)
                    else None
                )
                continue
            if not current_season:
                continue
            title = compact_text(heading.get_text(" ", strip=True)).removesuffix("#").strip()
            card = heading.find_parent("div", class_="w-full")
            if card is None:
                continue
            card_text = compact_text(card.get_text(" ", strip=True))
            author_node = heading.find_next_sibling("span")
            author_text = compact_text(author_node.get_text(" ", strip=True)) if author_node else ""
            author = author_text.removeprefix("By ").strip() or None
            description = card_text.removeprefix(f"{title} #").strip()
            if author_text and description.startswith(author_text):
                description = description[len(author_text) :].strip()
            section_links = all_links(card, self.source_url)
            if not description:
                continue
            key = slug_key(f"{current_season}-{title}")
            items.append(
                RawOpportunity(
                    source=self.source_name,
                    external_key=key,
                    title=title[:240],
                    description=description[:12000],
                    url=f"{self.source_url}#{slug_key(title)}",
                    author=author,
                    season=current_season,
                    links=list(dict.fromkeys(section_links)),
                    metadata={"reference_count": len(set(section_links))},
                )
            )
        return items

    def _fetch_rfs_bundle(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        script_urls = [
            urljoin(self.source_url, str(script.get("src")))
            for script in soup.select("script[src]")
        ]
        inertia_url = next((url for url in script_urls if "inertia-ycdc-" in url), None)
        if not inertia_url:
            return ""
        inertia_source, _ = self.fetch_url(inertia_url)
        registry_match = re.search(r"\./(component_registry-[A-Za-z0-9_-]+\.js)", inertia_source)
        if not registry_match:
            return ""
        registry_url = urljoin(inertia_url, registry_match.group(1))
        registry_source, _ = self.fetch_url(registry_url)
        page_match = re.search(r"\./(RequestsForStartupsPage-[A-Za-z0-9_-]+\.js)", registry_source)
        if not page_match:
            return ""
        bundle_url = urljoin(registry_url, page_match.group(1))
        bundle_source, _ = self.fetch_url(bundle_url)
        return bundle_source

    def _parse_bundle(self, source: str) -> list[RawOpportunity]:
        batches = _parse_javascript_batches(source)
        items: list[RawOpportunity] = []
        for batch in batches:
            season = str(batch.get("title", "")).strip()
            if not SEASON_RE.fullmatch(season):
                continue
            for entry in batch.get("items", []):
                title = compact_text(str(entry.get("title", "")))
                description = str(entry.get("description", "")).strip()
                if not title or not description:
                    continue
                author_data = entry.get("author") or {}
                author = compact_text(
                    " ".join(
                        value
                        for value in [author_data.get("firstName"), author_data.get("lastName")]
                        if value
                    )
                ) or None
                item_id = str(entry.get("id") or slug_key(title))
                links = list(dict.fromkeys(URL_RE.findall(description)))
                profile_url = author_data.get("profileUrl")
                if profile_url:
                    links.append(str(profile_url))
                video_id = entry.get("videoId")
                if video_id:
                    links.append(f"https://www.youtube.com/watch?v={video_id}")
                items.append(
                    RawOpportunity(
                        source=self.source_name,
                        external_key=slug_key(f"{season}-{item_id}"),
                        title=title[:240],
                        description=description[:12000],
                        url=f"{self.source_url}#{item_id}",
                        author=author,
                        season=season,
                        links=list(dict.fromkeys(links)),
                        metadata={
                            "batch_id": batch.get("id"),
                            "reference_count": len(set(links)),
                            "video_id": video_id,
                        },
                    )
                )
        return items


def _parse_javascript_batches(source: str) -> list[dict]:
    marker = re.search(
        r"=\[(?=\s*\{id:`(?:fall|summer|spring|winter)-20\d{2}`)",
        source,
        re.IGNORECASE,
    )
    if marker is None:
        return []
    literal = _extract_array_literal(source, marker.start() + 1)
    normalized = _normalize_javascript_literal(literal)
    value = json.loads(normalized)
    return value if isinstance(value, list) else []


def _extract_array_literal(source: str, start: int) -> str:
    depth = 0
    quote: str | None = None
    escaped = False
    for index in range(start, len(source)):
        character = source[index]
        if quote is not None:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {"`", '"', "'"}:
            quote = character
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                return source[start : index + 1]
    raise ValueError("Array de estações do YC não foi encerrado")


def _normalize_javascript_literal(literal: str) -> str:
    output: list[str] = []
    index = 0
    while index < len(literal):
        if literal[index] != "`":
            output.append(literal[index])
            index += 1
            continue
        index += 1
        value: list[str] = []
        while index < len(literal):
            character = literal[index]
            if character == "`":
                index += 1
                break
            if character == "\\" and index + 1 < len(literal):
                escaped = literal[index + 1]
                replacements = {"n": "\n", "r": "\r", "t": "\t", "`": "`", "\\": "\\"}
                value.append(replacements.get(escaped, f"\\{escaped}"))
                index += 2
                continue
            value.append(character)
            index += 1
        output.append(json.dumps("".join(value), ensure_ascii=False))
    normalized = _quote_javascript_keys("".join(output))
    normalized = normalized.replace(":!0", ":true").replace(":!1", ":false")
    return normalized


def _quote_javascript_keys(value: str) -> str:
    output: list[str] = []
    index = 0
    in_string = False
    escaped = False
    while index < len(value):
        character = value[index]
        output.append(character)
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            index += 1
            continue
        if character == '"':
            in_string = True
            index += 1
            continue
        if character not in {"{", ","}:
            index += 1
            continue
        index += 1
        while index < len(value) and value[index].isspace():
            output.append(value[index])
            index += 1
        key_match = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*", value[index:])
        if key_match is None:
            continue
        key = key_match.group(0)
        key_end = index + len(key)
        if key_end >= len(value) or value[key_end] != ":":
            continue
        output.append(json.dumps(key))
        output.append(":")
        index = key_end + 1
    return "".join(output)
