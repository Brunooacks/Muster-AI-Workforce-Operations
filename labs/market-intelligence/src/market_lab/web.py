import threading
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from market_lab.config import get_settings
from market_lab.pipeline import AGENTS, MarketIntelligencePipeline
from market_lab.store import Store


PACKAGE_DIR = Path(__file__).resolve().parent
settings = get_settings()
store = Store(settings)
pipeline = MarketIntelligencePipeline(settings, store)
run_lock = threading.Lock()

app = FastAPI(title="Cenyra Market Foresight", version="0.1.0")
app.mount("/static", StaticFiles(directory=PACKAGE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=PACKAGE_DIR / "templates")


@app.middleware("http")
async def prevent_stale_ui_assets(request: Request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.on_event("startup")
def startup() -> None:
    store.ensure_schema()


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "agents": len(AGENTS)}


@app.get("/api/report")
def report() -> dict:
    latest = store.latest_report()
    return latest.model_dump(mode="json") if latest else {"status": "empty"}


@app.get("/api/opportunities")
def opportunities(
    source: str | None = Query(default=None),
    min_score: int = Query(default=0, ge=0, le=100),
    limit: int = Query(default=300, ge=1, le=1000),
) -> list[dict]:
    items = store.latest_opportunities(limit=1000)
    return [
        item.model_dump(mode="json")
        for item in items
        if (not source or item.source == source) and item.opportunity_score >= min_score
    ][:limit]


@app.get("/api/runs")
def runs(limit: int = Query(default=20, ge=1, le=200)) -> list[dict]:
    return [run.model_dump(mode="json") for run in store.latest_runs(limit)]


@app.get("/api/history")
def history(limit: int = Query(default=30, ge=1, le=365)) -> list[dict]:
    return store.report_history(limit)


def _run_pipeline() -> None:
    if not run_lock.acquire(blocking=False):
        return
    try:
        pipeline.run_all()
    finally:
        run_lock.release()


@app.post("/api/run", status_code=status.HTTP_202_ACCEPTED)
def trigger_run(background_tasks: BackgroundTasks) -> dict:
    if run_lock.locked():
        raise HTTPException(status_code=409, detail="Uma coleta já está em execução.")
    background_tasks.add_task(_run_pipeline)
    return {"status": "accepted", "message": "Coleta iniciada em segundo plano."}


@app.post("/api/reanalyze")
def reanalyze() -> dict:
    if not run_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Uma execução já está em andamento.")
    try:
        result = pipeline.reanalyze_current()
        return {
            "status": "completed",
            "sources": result["sources"],
            "report_date": result["report"]["report_date"],
        }
    finally:
        run_lock.release()


@app.get("/metrics", response_class=PlainTextResponse)
def prometheus_metrics() -> str:
    lines = [
        "# HELP market_lab_agent_records Records discovered in the latest run",
        "# TYPE market_lab_agent_records gauge",
        "# HELP market_lab_agent_duration_ms Latest run duration in milliseconds",
        "# TYPE market_lab_agent_duration_ms gauge",
        "# HELP market_lab_agent_success Latest run success status",
        "# TYPE market_lab_agent_success gauge",
        "# HELP market_lab_agent_translation_coverage Share of records available in Portuguese",
        "# TYPE market_lab_agent_translation_coverage gauge",
        "# HELP market_lab_agent_business_detail_coverage Share of records with a business dossier",
        "# TYPE market_lab_agent_business_detail_coverage gauge",
        "# HELP market_lab_agent_market_research_coverage Share of records with external market evidence",
        "# TYPE market_lab_agent_market_research_coverage gauge",
        "# HELP market_lab_agent_analysis_quality Average analysis quality score",
        "# TYPE market_lab_agent_analysis_quality gauge",
    ]
    seen: set[str] = set()
    for run in store.latest_runs(100):
        if run.source in seen or run.source == "synthesis":
            continue
        seen.add(run.source)
        labels = f'agent="{run.agent_name}",framework="{run.framework}",source="{run.source}"'
        lines.append(f"market_lab_agent_records{{{labels}}} {run.metrics.records_discovered}")
        lines.append(f"market_lab_agent_duration_ms{{{labels}}} {run.metrics.duration_ms}")
        lines.append(f"market_lab_agent_success{{{labels}}} {1 if run.status == 'completed' else 0}")
        lines.append(
            f"market_lab_agent_translation_coverage{{{labels}}} "
            f"{run.metrics.translation_coverage}"
        )
        lines.append(
            f"market_lab_agent_business_detail_coverage{{{labels}}} "
            f"{run.metrics.business_detail_coverage}"
        )
        lines.append(
            f"market_lab_agent_market_research_coverage{{{labels}}} "
            f"{run.metrics.market_research_coverage}"
        )
        lines.append(
            f"market_lab_agent_analysis_quality{{{labels}}} "
            f"{run.metrics.analysis_quality}"
        )
    return "\n".join(lines) + "\n"
