#!/usr/bin/env python3
"""Master orchestrator - runs all scrapers in sequence"""
import subprocess
import sys
import os
from datetime import datetime

def run(name, script):
    print(f"\n{'='*70}\n{name}\n{'='*70}\n")
    # Resolve absolute path for script
    script_path = os.path.abspath(script)
    result = subprocess.run([sys.executable, script_path], check=False)
    return result.returncode == 0

scrapers = [
    ("Legislation.gov.uk", "apps/law-scraper/scrapers/legislation_scraper.py"),
    ("GOV.UK Content API", "apps/law-scraper/scrapers/govuk_scraper.py"),
    ("ACAS", "apps/law-scraper/scrapers/acas_scraper.py"),
    ("Find Case Law", "apps/law-scraper/scrapers/caselaw_scraper.py"),
]

def main():
    print(f"🚀 SCRAPING START: {datetime.now()}\n")
    results = {name: run(name, script) for name, script in scrapers}

    print(f"\n{'='*70}\nSUMMARY\n{'='*70}\n")
    for name, success in results.items():
        print(f"{'✅' if success else '❌'} {name}")

    sys.exit(0 if all(results.values()) else 1)

if __name__ == "__main__":
    main()
