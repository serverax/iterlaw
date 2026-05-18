#!/usr/bin/env python3
"""
Scrape National Archives Find Case Law API
"""

import requests
import psycopg2
import json
import os
from datetime import datetime

class CaseLawScraper:
    def __init__(self, db_connection_string):
        self.db = psycopg2.connect(db_connection_string)
        self.cursor = self.db.cursor()
        self.base_url = "https://caselaw.nationalarchives.gov.uk/api"

    def scrape_employment_cases(self):
        """Scrape employment tribunal decisions"""
        print("📥 Scraping Find Case Law API - Employment Cases\n")

        try:
            # Get latest employment cases
            url = f"{self.base_url}/judgments?page=1&ordering=-date_of_publication"
            response = requests.get(url, timeout=15)

            if response.status_code == 200:
                data = response.json()

                # Process results
                for judgment in data.get('results', [])[:50]:  # First 50 cases
                    print(f"  → {judgment.get('name', 'Unknown')}")

                    self.store_case(
                        case_name=judgment.get('name', ''),
                        neutral_citation=judgment.get('neutral_citation', ''),
                        summary=judgment.get('description', ''),
                        url=judgment.get('uri', ''),
                        source="caselaw.nationalarchives.gov.uk",
                        source_id=judgment.get('uri', '').split('/')[-1],
                        category="Employment Law",
                        tribunal="Employment Tribunal"
                    )
                    print(f"    ✅ Stored")
        except Exception as e:
            print(f"  ❌ Error: {e}")

    def store_case(self, case_name: str, neutral_citation: str, summary: str,
                  url: str, source: str, source_id: str, category: str, tribunal: str):
        """Store case law"""
        try:
            self.cursor.execute("SELECT id FROM law_categories WHERE name = %s", (category,))
            result = self.cursor.fetchone()
            if not result:
                return
            category_id = result[0]

            self.cursor.execute("""
                INSERT INTO case_law
                (category_id, case_name, neutral_citation, summary, url, source, source_id, tribunal)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET updated_at = NOW()
            """, (category_id, case_name, neutral_citation, summary, url, source, source_id, tribunal))

            self.db.commit()
        except Exception as e:
            print(f"    ❌ DB Error: {e}")
            self.db.rollback()

    def run_all(self):
        print("🚀 Starting Find Case Law Scraper\n")
        self.scrape_employment_cases()
        print("\n✅ Find Case Law scraping complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:dev-postgres-password@localhost:5432/iterlaw_knowledge")
    scraper = CaseLawScraper(db_string)
    scraper.run_all()
