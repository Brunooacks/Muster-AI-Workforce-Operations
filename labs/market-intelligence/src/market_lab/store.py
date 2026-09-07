import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from tenacity import retry, stop_after_attempt, wait_fixed

from market_lab.config import Settings
from market_lab.models import AgentRun, DailyReport, RunMetrics, ScoredOpportunity


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY,
  agent_name text NOT NULL,
  framework text NOT NULL,
  source text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS agent_runs_source_started_idx ON agent_runs(source, started_at DESC);

CREATE TABLE IF NOT EXISTS opportunity_snapshots (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_key text NOT NULL,
  collected_at timestamptz NOT NULL,
  opportunity_score integer NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS opportunity_latest_idx
  ON opportunity_snapshots(source, external_key, collected_at DESC);

CREATE TABLE IF NOT EXISTS daily_reports (
  report_date date PRIMARY KEY,
  generated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);
"""


class Store:
    def __init__(self, settings: Settings):
        self.settings = settings

    @contextmanager
    def connection(self) -> Iterator[psycopg.Connection]:
        with psycopg.connect(self.settings.database_url, row_factory=dict_row) as connection:
            yield connection

    @retry(stop=stop_after_attempt(20), wait=wait_fixed(2), reraise=True)
    def ensure_schema(self) -> None:
        with self.connection() as connection:
            connection.execute(SCHEMA_SQL)
            connection.commit()

    def start_run(self, agent_name: str, framework: str, source: str) -> str:
        run_id = str(uuid.uuid4())
        with self.connection() as connection:
            connection.execute(
                """INSERT INTO agent_runs
                (id, agent_name, framework, source, status, started_at, metrics)
                VALUES (%s, %s, %s, %s, 'running', %s, %s)""",
                (
                    run_id,
                    agent_name,
                    framework,
                    source,
                    datetime.now(timezone.utc),
                    Jsonb(RunMetrics().model_dump(mode="json")),
                ),
            )
            connection.commit()
        return run_id

    def finish_run(
        self,
        run_id: str,
        status: str,
        metrics: RunMetrics,
        error: str | None = None,
    ) -> None:
        with self.connection() as connection:
            connection.execute(
                """UPDATE agent_runs
                SET status=%s, completed_at=%s, metrics=%s, error=%s
                WHERE id=%s""",
                (
                    status,
                    datetime.now(timezone.utc),
                    Jsonb(metrics.model_dump(mode="json")),
                    error,
                    run_id,
                ),
            )
            connection.commit()

    def save_opportunities(self, run_id: str, items: list[ScoredOpportunity]) -> None:
        if not items:
            return
        with self.connection() as connection:
            with connection.cursor() as cursor:
                cursor.executemany(
                    """INSERT INTO opportunity_snapshots
                    (run_id, source, external_key, collected_at, opportunity_score, payload)
                    VALUES (%s, %s, %s, %s, %s, %s)""",
                    [
                        (
                            run_id,
                            item.source,
                            item.external_key,
                            item.collected_at,
                            item.opportunity_score,
                            Jsonb(item.model_dump(mode="json")),
                        )
                        for item in items
                    ],
                )
            connection.commit()

    def latest_opportunities(self, limit: int = 500) -> list[ScoredOpportunity]:
        with self.connection() as connection:
            rows = connection.execute(
                """WITH latest_runs AS (
                    SELECT DISTINCT ON (source) id, source
                    FROM agent_runs
                    WHERE status = 'completed' AND source <> 'synthesis'
                    ORDER BY source, started_at DESC
                )
                SELECT snapshots.payload
                FROM opportunity_snapshots snapshots
                JOIN latest_runs runs ON runs.id = snapshots.run_id
                ORDER BY snapshots.opportunity_score DESC
                LIMIT %s""",
                (limit,),
            ).fetchall()
        return [ScoredOpportunity.model_validate(row["payload"]) for row in rows]

    def latest_runs(self, limit: int = 20) -> list[AgentRun]:
        with self.connection() as connection:
            rows = connection.execute(
                """SELECT id::text, agent_name, framework, source, status,
                   started_at, completed_at, metrics, error
                   FROM agent_runs ORDER BY started_at DESC LIMIT %s""",
                (limit,),
            ).fetchall()
        return [AgentRun.model_validate(row) for row in rows]

    def save_report(self, report: DailyReport) -> None:
        with self.connection() as connection:
            connection.execute(
                """INSERT INTO daily_reports(report_date, generated_at, payload)
                VALUES (%s, %s, %s)
                ON CONFLICT(report_date) DO UPDATE
                SET generated_at=excluded.generated_at, payload=excluded.payload""",
                (
                    report.report_date,
                    report.generated_at,
                    Jsonb(report.model_dump(mode="json")),
                ),
            )
            connection.execute(
                """DELETE FROM daily_reports
                WHERE report_date > %s AND generated_at < %s""",
                (report.report_date, report.generated_at),
            )
            connection.commit()

    def latest_report(self) -> DailyReport | None:
        with self.connection() as connection:
            row = connection.execute(
                "SELECT payload FROM daily_reports ORDER BY generated_at DESC LIMIT 1"
            ).fetchone()
        return DailyReport.model_validate(row["payload"]) if row else None

    def report_history(self, limit: int = 30) -> list[dict]:
        with self.connection() as connection:
            rows = connection.execute(
                """SELECT report_date::text, generated_at, payload
                FROM daily_reports ORDER BY generated_at DESC LIMIT %s""",
                (limit,),
            ).fetchall()
        return [
            {
                "report_date": row["report_date"],
                "generated_at": row["generated_at"].isoformat(),
                "opportunity_count": row["payload"].get("opportunity_count", 0),
                "top_score": max(
                    [item.get("opportunity_score", 0) for item in row["payload"].get("top_opportunities", [])],
                    default=0,
                ),
            }
            for row in rows
        ]

    def export_state(self) -> str:
        payload = {
            "report": self.latest_report().model_dump(mode="json") if self.latest_report() else None,
            "runs": [run.model_dump(mode="json") for run in self.latest_runs()],
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)
