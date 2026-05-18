#!/usr/bin/env python3
"""
Scrape ACAS guidance documents
"""

import requests
import psycopg2
import os
from bs4 import BeautifulSoup

class ACAScraper:
    def __init__(self, db_connection_string):
        self.db = psycopg2.connect(db_connection_string)
        self.cursor = self.db.cursor()

    def scrape_acas(self):
        """Scrape ACAS Code of Practice"""
        print("📥 Scraping ACAS\n")

        urls = [
            {
                "url": "https://www.acas.org.uk/code-of-practice-on-disciplinary-and-grievance-procedures",
                "title": "ACAS Code of Practice on Disciplinary and Grievance Procedures",
                "category": "Employment Law"
            },
            {
                "url": "https://www.acas.org.uk/discrimination",
                "title": "ACAS - Discrimination",
                "category": "Employment Law"
            },
            {
                "url": "https://www.acas.org.uk/dismissal",
                "title": "ACAS - Dismissal",
                "category": "Employment Law"
            },
        ]

        for item in urls:
            print(f"  → {item['title']}")
            try:
                response = requests.get(item['url'], timeout=15)
                if response.status_code == 200:
                    self.store_guidance(
                        title=item['title'],
                        full_text=response.text,
                        url=item['url'],
                        source="ACAS",
                        category=item['category'],
                        organization="ACAS"
                    )
                    print(f"    ✅ Stored")
            except Exception as e:
                print(f"    ❌ Error: {e}")

    def store_guidance(self, title: str, full_text: str, url: str, source: str,
                      category: str, organization: str):
        """Store guidance"""
        try:
            self.cursor.execute("SELECT id FROM law_categories WHERE name = %s", (category,))
            result = self.cursor.fetchone()
            if not result:
                return
            category_id = result[0]

            self.cursor.execute("""
                INSERT INTO guidance
                (category_id, title, full_text, url, source, organization)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET updated_at = NOW()
            """, (category_id, title, full_text, url, source, organization))

            self.db.commit()
        except Exception as e:
            print(f"    ❌ DB Error: {e}")
            self.db.rollback()

    def run_all(self):
        print("🚀 Starting ACAS Scraper\n")
        self.scrape_acas()
        print("\n✅ ACAS scraping complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:dev-postgres-password@localhost:5432/iterlaw_knowledge")
    scraper = ACAScraper(db_string)
    scraper.run_all()
