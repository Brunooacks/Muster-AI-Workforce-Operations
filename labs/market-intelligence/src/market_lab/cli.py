import argparse
import json
import signal
import sys

from apscheduler.schedulers.blocking import BlockingScheduler

from market_lab.config import get_settings
from market_lab.pipeline import AGENTS, MarketIntelligencePipeline
from market_lab.store import Store


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="market-lab")
    subparsers = parser.add_subparsers(dest="command", required=True)
    collect = subparsers.add_parser("collect", help="Executa uma coleta")
    collect.add_argument("--source", choices=["all", *AGENTS.keys()], default="all")
    subparsers.add_parser("scheduler", help="Executa a rotina diária")
    subparsers.add_parser("status", help="Exibe o último estado persistido")
    subparsers.add_parser("reanalyze", help="Reanalisa a base atual sem nova coleta")
    return parser


def run_collect(source: str) -> dict:
    settings = get_settings()
    store = Store(settings)
    store.ensure_schema()
    pipeline = MarketIntelligencePipeline(settings, store)
    if source == "all":
        result = pipeline.run_all()
        report = result["report"]
        return {
            "sources": result["sources"],
            "report": {
                "report_date": report["report_date"],
                "opportunity_count": report["opportunity_count"],
                "total_links": report["total_links"],
            },
        }
    items = pipeline.run_source(source)
    return {"source": source, "status": "completed", "records": len(items)}


def run_scheduler() -> None:
    settings = get_settings()
    store = Store(settings)
    store.ensure_schema()
    pipeline = MarketIntelligencePipeline(settings, store)
    if settings.run_on_start:
        result = pipeline.run_all()
        print(
            json.dumps(
                {
                    "event": "initial_collection_completed",
                    "sources": result["sources"],
                    "report_date": result["report"]["report_date"],
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
    scheduler = BlockingScheduler(timezone=settings.timezone)
    scheduler.add_job(
        pipeline.run_all,
        "cron",
        hour=settings.daily_run_hour,
        minute=settings.daily_run_minute,
        id="daily-market-intelligence",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    signal.signal(signal.SIGTERM, lambda *_: scheduler.shutdown(wait=False))
    scheduler.start()


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "collect":
        print(json.dumps(run_collect(args.source), ensure_ascii=False, indent=2))
    elif args.command == "scheduler":
        run_scheduler()
    elif args.command == "status":
        settings = get_settings()
        store = Store(settings)
        store.ensure_schema()
        print(store.export_state())
    elif args.command == "reanalyze":
        settings = get_settings()
        store = Store(settings)
        store.ensure_schema()
        pipeline = MarketIntelligencePipeline(settings, store)
        result = pipeline.reanalyze_current()
        print(
            json.dumps(
                {
                    "sources": result["sources"],
                    "report_date": result["report"]["report_date"],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        sys.exit(2)


if __name__ == "__main__":
    main()
