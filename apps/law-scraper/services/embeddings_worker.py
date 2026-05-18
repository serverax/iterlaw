"""
IterLaw embeddings generation worker (sentence-transformers).
Docker entrypoint; Ollama batch path remains in embeddings_service.py.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import List

import numpy as np
import psycopg2
import redis
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from sentence_transformers import SentenceTransformer

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:rightsnow_secure_password_2026@postgres:5432/rightsnow"
)
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "32"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
DEVICE = os.getenv("DEVICE", "cpu")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "3600"))
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8080"))
METRICS_PORT = int(os.getenv("METRICS_PORT", "8000"))

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/embeddings.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("embeddings_worker")

embeddings_generated = Counter(
    "embeddings_generated_total",
    "Total embeddings generated",
    ["source_type"],
)
embedding_latency = Histogram(
    "embedding_generation_seconds",
    "Time to generate embeddings",
    ["model"],
)
pending_embeddings = Gauge(
    "pending_embeddings",
    "Records pending embeddings",
    ["source_type"],
)


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path in ("/health", "/health/"):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *_args) -> None:
        return


def start_health_server(port: int) -> None:
    server = HTTPServer(("0.0.0.0", port), _HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info("Health server listening on :%s/health", port)


def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


def get_redis_connection():
    client = redis.from_url(REDIS_URL, decode_responses=True)
    client.ping()
    return client


def vector_literal(embedding: np.ndarray) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in embedding.tolist()) + "]"


class EmbeddingsModel:
    def __init__(self) -> None:
        logger.info("Loading model %s on %s", EMBEDDING_MODEL, DEVICE)
        self.model = SentenceTransformer(EMBEDDING_MODEL, device=DEVICE)
        logger.info("Model dimension=%s", self.model.get_sentence_embedding_dimension())

    @embedding_latency.labels(model=EMBEDDING_MODEL).time()
    def encode(self, texts: List[str]) -> np.ndarray:
        return self.model.encode(
            texts,
            batch_size=BATCH_SIZE,
            show_progress_bar=False,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )


class EmbeddingsSyncJob:
    def __init__(self) -> None:
        self.db = get_db_connection()
        self.redis = get_redis_connection()
        self.encoder = EmbeddingsModel()

    def _sync_table(
        self,
        source_type: str,
        select_sql: str,
        update_sql: str,
        text_fn,
    ) -> None:
        cursor = self.db.cursor()
        try:
            cursor.execute(select_sql, (BATCH_SIZE,))
            records = cursor.fetchall()
            if not records:
                logger.info("No pending %s embeddings", source_type)
                return
            logger.info("Generating %s embeddings for %d records", source_type, len(records))
            texts = [text_fn(r) for r in records]
            vectors = self.encoder.encode(texts)
            for record, vec in zip(records, vectors):
                record_id = record[0]
                cursor.execute(update_sql, (vector_literal(vec), record_id))
                embeddings_generated.labels(source_type=source_type).inc()
            self.db.commit()
            logger.info("Stored %d %s embeddings", len(records), source_type)
        except Exception:
            self.db.rollback()
            logger.exception("Failed syncing %s", source_type)
            raise
        finally:
            cursor.close()

    def sync_legislation_embeddings(self) -> None:
        self._sync_table(
            "legislation",
            """
            SELECT statute_id, statute_name, section_number, full_text
            FROM legislation_database
            WHERE embedding IS NULL
            LIMIT %s
            """,
            """
            UPDATE legislation_database
            SET embedding = %s::vector, embedding_generated_at = NOW(), updated_at = NOW()
            WHERE statute_id = %s
            """,
            lambda r: f"{r[1]} Section {r[2]}: {(r[3] or '')[:500]}",
        )

    def sync_caselaw_embeddings(self) -> None:
        self._sync_table(
            "caselaw",
            """
            SELECT case_id, case_name, legal_principle, full_judgment_text
            FROM case_law_database
            WHERE embedding IS NULL
            LIMIT %s
            """,
            """
            UPDATE case_law_database
            SET embedding = %s::vector, embedding_generated_at = NOW(), updated_at = NOW()
            WHERE case_id = %s
            """,
            lambda r: f"{r[1]}: {r[2]} {(r[3] or '')[:300]}",
        )

    def sync_guidance_embeddings(self) -> None:
        self._sync_table(
            "guidance",
            """
            SELECT guidance_id, title, content
            FROM acas_guidance
            WHERE embedding IS NULL
            LIMIT %s
            """,
            """
            UPDATE acas_guidance
            SET embedding = %s::vector, embedding_generated_at = NOW(), updated_at = NOW()
            WHERE guidance_id = %s
            """,
            lambda r: f"{r[1]}: {(r[2] or '')[:500]}",
        )

    def sync_qa_embeddings(self) -> None:
        self._sync_table(
            "qa",
            """
            SELECT qa_id, question_text
            FROM qa_database
            WHERE question_embedding IS NULL
            LIMIT %s
            """,
            """
            UPDATE qa_database
            SET question_embedding = %s::vector, embedding_generated_at = NOW()
            WHERE qa_id = %s
            """,
            lambda r: r[1],
        )

    def update_pending_metrics(self) -> None:
        checks = [
            ("legislation_database", "embedding", "legislation"),
            ("case_law_database", "embedding", "caselaw"),
            ("acas_guidance", "embedding", "guidance"),
            ("qa_database", "question_embedding", "qa"),
        ]
        cursor = self.db.cursor()
        try:
            for table, column, label in checks:
                cursor.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE {column} IS NULL"
                )
                pending_embeddings.labels(source_type=label).set(cursor.fetchone()[0])
        finally:
            cursor.close()

    def run_sync_cycle(self) -> None:
        logger.info("Starting embeddings sync cycle at %s", datetime.utcnow().isoformat())
        self.sync_legislation_embeddings()
        self.sync_caselaw_embeddings()
        self.sync_guidance_embeddings()
        self.sync_qa_embeddings()
        self.update_pending_metrics()
        logger.info("Embeddings sync cycle complete at %s", datetime.utcnow().isoformat())

    def cleanup(self) -> None:
        self.db.close()
        self.redis.close()


async def main() -> None:
    start_health_server(HEALTH_PORT)
    start_http_server(METRICS_PORT)
    job = EmbeddingsSyncJob()
    logger.info(
        "Embeddings worker started model=%s batch=%s interval=%ss",
        EMBEDDING_MODEL,
        BATCH_SIZE,
        SYNC_INTERVAL,
    )
    try:
        while True:
            try:
                job.run_sync_cycle()
                await asyncio.sleep(SYNC_INTERVAL)
            except Exception:
                logger.exception("Sync cycle error; retry in 60s")
                await asyncio.sleep(60)
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    finally:
        job.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
