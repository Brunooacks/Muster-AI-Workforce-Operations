from datetime import datetime, timezone

from market_lab.collectors.base import collection_hash
from market_lab.collectors.leaderboards import MelhorLanceCollector, OutbidCollector
from market_lab.collectors.yc_rfs import YcRfsCollector, _parse_javascript_batches
from market_lab.config import Settings
from market_lab.models import RawOpportunity


SETTINGS = Settings(max_items_per_source=100)


def test_melhor_lance_extracts_rank_price_clicks_and_links():
    html = """
    <main><article><span>#1</span><a href="/l/produto-id">produto.dev</a>
    <p>Automação para times brasileiros.</p><span>97 cliques</span><strong>R$ 1.008</strong>
    <a href="https://produto.dev/docs">docs</a></article></main>
    """
    items = MelhorLanceCollector(SETTINGS).parse(html)
    assert len(items) == 1
    assert items[0].rank == 1
    assert items[0].paid_value == 1008
    assert items[0].clicks == 97
    assert len(items[0].links) == 2


def test_outbid_extracts_usd_and_global_rank():
    html = """
    <article><h2>#2</h2><a href="https://joni.ai">JONI</a>
    <a href="/category/ai">AI</a><p>Personal AI computer.</p>
    <strong>$14,028</strong><span>16224 clicks</span></article>
    """
    items = OutbidCollector(SETTINGS).parse(html)
    assert len(items) == 1
    assert items[0].paid_value == 14028
    assert items[0].currency == "USD"
    assert items[0].clicks == 16224
    assert items[0].category == "AI"
    assert items[0].description == "Personal AI computer."


def test_yc_rfs_extracts_season_author_and_references():
    html = """
    <h2>Fall 2026</h2>
    <div class="w-full"><div><h3>New Operating Systems</h3><span>By Charlie Warren</span></div>
    <p>Manage agents, robots and humans in the physical world.</p><a href="https://x.com/author">reference</a></div>
    <div class="w-full"><div><h3>The Primer</h3><span>By Andrew</span></div>
    <p>Adaptive tutor.</p><a href="/people/andrew">reference</a></div>
    """
    items = YcRfsCollector(SETTINGS).parse(html)
    assert len(items) == 2
    assert items[0].season == "Fall 2026"
    assert items[0].author == "Charlie Warren"
    assert items[0].links == ["https://x.com/author"]


def test_yc_rfs_bundle_extracts_all_batches_and_metadata():
    source = """const f=[
      {id:`fall-2026`,title:`Fall 2026`,description:`Current`,items:[
        {id:`primer`,title:`The Primer`,description:`Tutor enough, too: today with https://example.com`,
         author:{firstName:`Andrew`,lastName:`Lee`,profileUrl:`https://www.ycombinator.com/people/andrew`},
         videoId:`abc`,isShorts:!0}]},
      {id:`summer-2026`,title:`Summer 2026`,description:`Previous`,items:[
        {id:`agriculture`,title:`AI Agriculture`,description:`Lower pesticide use`,
         author:{firstName:`Harsha`,lastName:`Gaddipati`,profileUrl:`https://www.ycombinator.com/companies/slashy`}}]}
    ];"""
    batches = _parse_javascript_batches(source)
    items = YcRfsCollector(SETTINGS)._parse_bundle(source)
    assert len(batches) == 2
    assert len(items) == 2
    assert items[0].author == "Andrew Lee"
    assert items[0].season == "Fall 2026"
    assert items[0].metadata["video_id"] == "abc"
    assert items[1].season == "Summer 2026"


def test_collection_hash_tracks_content_instead_of_runtime_metadata():
    first = RawOpportunity(
        source="outbid",
        external_key="agent-a",
        title="Agent A",
        description="Observed product",
        url="https://example.com/a",
        links=["https://example.com/b", "https://example.com/a"],
        metadata={"request_id": "dynamic-1"},
        collected_at=datetime(2026, 9, 6, 10, tzinfo=timezone.utc),
    )
    second = RawOpportunity(
        source="outbid",
        external_key="agent-b",
        title="Agent B",
        description="Observed product",
        url="https://example.com/b",
    )
    equivalent = first.model_copy(
        update={
            "links": list(reversed(first.links)),
            "metadata": {"request_id": "dynamic-2"},
            "collected_at": datetime(2026, 9, 6, 11, tzinfo=timezone.utc),
        }
    )

    assert collection_hash([first, second]) == collection_hash([second, equivalent])
    assert collection_hash([first]) != collection_hash(
        [first.model_copy(update={"title": "Agent A changed"})]
    )
