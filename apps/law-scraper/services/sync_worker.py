"""
Periodic scraper sync for case law and related sources.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import sys
from datetime import datetime

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "86400"))

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/case_law_sync.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("sync_worker")

SCRAPERS = [
    ("caselaw", "scrapers/caselaw_scraper.py"),
    ("legislation", "scrapers/legislation_scraper.py"),
    ("acas", "scrapers/acas_scraper.py"),
    ("govuk", "scrapers/govuk_scraper.py"),
]


def run_scraper(name: str, script: str) -> bool:
    logger.info("Running scraper %s (%s)", name, script)
    result = subprocess.run([sys.executable, script], cwd="/app", check=False)
    ok = result.returncode == 0
    if not ok:
        logger.error("Scraper %s failed with code %s", name, result.returncode)
    return ok


def run_cycle() -> None:
    logger.info("Sync cycle start %s", datetime.utcnow().isoformat())
    for name, script in SCRAPERS:
        run_scraper(name, script)
    logger.info("Sync cycle end %s", datetime.utcnow().isoformat())


async def main() -> None:
    os.makedirs("logs", exist_ok=True)
    logger.info("Case law sync worker interval=%ss", SYNC_INTERVAL)
    while True:
        try:
            run_cycle()
        except Exception:
            logger.exception("Sync cycle error")
        await asyncio.sleep(SYNC_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
