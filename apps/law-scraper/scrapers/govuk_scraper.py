#!/usr/bin/env python3
"""
Scrape GOV.UK Content API for employment guidance
"""

import requests
import psycopg2
import json
import os
from typing import List, Dict

class GOVUKScraper:
    def __init__(self, db_connection_string):
        self.db = psycopg2.connect(db_connection_string)
        self.cursor = self.db.cursor()
        self.base_url = "https://www.gov.uk/api/content"

    def scrape_employment_guidance(self):
        """Scrape GOV.UK employment guidance"""
        print("📥 Scraping GOV.UK Content API - Employment Guidance\n")

        guidance_paths = [
            {"path": "workplace-rights", "category": "Employment Law"},
            {"path": "employment-rights-when-dismissed", "category": "Employment Law"},
            {"path": "minimum-wage-rights", "category": "Employment Law"},
            {"path": "working-time-regulations", "category": "Employment Law"},
            {"path": "discrimination-your-rights", "category": "Employment Law"},
            {"path": "whistleblowing", "category": "Employment Law"},
            {"path": "statutory-sick-pay", "category": "Employment Law"},
            {"path": "maternity-rights", "category": "Employment Law"},
            {"path": "redundancy-your-rights", "category": "Employment Law"},
            {"path": "working-with-disabilities", "category": "Employment Law"},
            {"path": "renters-rights", "category": "Housing & Tenant Rights"},
            {"path": "consumer-rights", "category": "Consumer Rights"},
        ]

        for item in guidance_paths:
            path = item['path']
            category = item['category']
            print(f"  → {path}")

            try:
                url = f"{self.base_url}/{path}"
                response = requests.get(url, timeout=10)

                if response.status_code == 200:
                    data = response.json()

                    # Extract content
                    title = data.get('title', path)
                    body = data.get('details', {}).get('body', '')
                    description = data.get('description', '')
                    full_text = f"{description}\n\n{body}"

                    self.store_guidance(
                        title=title,
                        full_text=full_text,
                        url=f"https://www.gov.uk/{path}",
                        source="gov.uk",
                        category=category,
                        organization="GOV.UK"
                    )
                    print(f"    ✅ Stored")
                else:
                    print(f"    ⚠️  HTTP {response.status_code}")
            except Exception as e:
                print(f"    ❌ Error: {e}")

    def store_guidance(self, title: str, full_text: str, url: str, source: str,
                      category: str, organization: str):
        """Store guidance in database"""
        try:
            # Get category ID
            self.cursor.execute("SELECT id FROM law_categories WHERE name = %s", (category,))
            result = self.cursor.fetchone()
            if not result:
                return
            category_id = result[0]

            # Store guidance
            self.cursor.execute("""
                INSERT INTO guidance
                (category_id, title, full_text, url, source, organization)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET created_at = NOW()
            """, (category_id, title, full_text, url, source, organization))

            self.db.commit()
        except Exception as e:
            print(f"    ❌ DB Error: {e}")
            self.db.rollback()

    def run_all(self):
        """Run all scrapers"""
        print("🚀 Starting GOV.UK Scraper\n")
        self.scrape_employment_guidance()
        print("\n✅ GOV.UK scraping complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:dev-postgres-password@localhost:5432/iterlaw_knowledge")
    scraper = GOVUKScraper(db_string)
    scraper.run_all()
