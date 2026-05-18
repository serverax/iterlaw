#!/usr/bin/env python3
"""
Scrape legislation.gov.uk for British law
"""

import requests
import json
import psycopg2
from datetime import datetime
import xml.etree.ElementTree as ET
from typing import List, Dict

class LegislationScraper:
    def __init__(self, db_connection_string):
        self.db = psycopg2.connect(db_connection_string)
        self.cursor = self.db.cursor()
        self.session = requests.Session()

    def scrape_employment_law(self):
        """Scrape core employment law acts"""
        print("📥 Scraping legislation.gov.uk - Employment Law\n")

        # Key acts to scrape
        acts = [
            {
                "title": "Employment Rights Act 1996",
                "url": "https://www.legislation.gov.uk/ukpga/1996/18",
                "year": 1996,
                "category": "Employment Law"
            },
            {
                "title": "Equality Act 2010",
                "url": "https://www.legislation.gov.uk/ukpga/2010/15",
                "year": 2010,
                "category": "Employment Law"
            },
            {
                "title": "Trade Union and Labour Relations (Consolidation) Act 1992",
                "url": "https://www.legislation.gov.uk/ukpga/1992/52",
                "year": 1992,
                "category": "Employment Law"
            },
            {
                "title": "Health and Safety at Work etc. Act 1974",
                "url": "https://www.legislation.gov.uk/ukpga/1974/37",
                "year": 1974,
                "category": "Employment Law"
            },
            {
                "title": "Public Interest Disclosure Act 1998",
                "url": "https://www.legislation.gov.uk/ukpga/1998/23",
                "year": 1998,
                "category": "Employment Law"
            },
        ]

        for act in acts:
            print(f"  → {act['title']}")

            # Fetch XML version
            xml_url = f"{act['url']}/data.xml"
            try:
                response = self.session.get(xml_url, timeout=15)
                if response.status_code == 200:
                    self.store_legislation(
                        title=act['title'],
                        url=act['url'],
                        full_text=response.text,
                        year=act['year'],
                        source="legislation.gov.uk",
                        source_id=act['url'].split('/')[-1],
                        category=act['category'],
                        act_type="Act"
                    )
                    print(f"    ✅ Stored")
                else:
                    print(f"    ⚠️  HTTP {response.status_code}")
            except Exception as e:
                print(f"    ❌ Error: {e}")

    def scrape_statutory_instruments(self):
        """Scrape key statutory instruments"""
        print("\n📥 Scraping Statutory Instruments\n")

        instruments = [
            {
                "title": "Working Time Regulations 1998",
                "url": "https://www.legislation.gov.uk/uksi/1998/1833",
                "year": 1998,
                "category": "Employment Law"
            },
            {
                "title": "National Minimum Wage Regulations 2015",
                "url": "https://www.legislation.gov.uk/uksi/2015/621",
                "year": 2015,
                "category": "Employment Law"
            },
            {
                "title": "Part-time Workers (Prevention of Less Favourable Treatment) Regulations 2000",
                "url": "https://www.legislation.gov.uk/uksi/2000/1925",
                "year": 2000,
                "category": "Employment Law"
            },
            {
                "title": "Fixed-term Employees (Prevention of Less Favourable Treatment) Regulations 2002",
                "url": "https://www.legislation.gov.uk/uksi/2002/2034",
                "year": 2002,
                "category": "Employment Law"
            },
        ]

        for instrument in instruments:
            print(f"  → {instrument['title']}")

            xml_url = f"{instrument['url']}/data.xml"
            try:
                response = self.session.get(xml_url, timeout=15)
                if response.status_code == 200:
                    self.store_legislation(
                        title=instrument['title'],
                        url=instrument['url'],
                        full_text=response.text,
                        year=instrument['year'],
                        source="legislation.gov.uk",
                        source_id=instrument['url'].split('/')[-1],
                        category=instrument['category'],
                        act_type="Statutory Instrument"
                    )
                    print(f"    ✅ Stored")
                else:
                    print(f"    ⚠️  HTTP {response.status_code}")
            except Exception as e:
                print(f"    ❌ Error: {e}")

    def store_legislation(self, title: str, url: str, full_text: str, year: int,
                         source: str, source_id: str, category: str, act_type: str):
        """Store legislation in database"""
        try:
            # Get category ID
            self.cursor.execute("SELECT id FROM law_categories WHERE name = %s", (category,))
            result = self.cursor.fetchone()
            if not result:
                print(f"    ⚠️  Category '{category}' not found")
                return
            category_id = result[0]

            # Store legislation
            self.cursor.execute("""
                INSERT INTO legislation
                (category_id, title, year, act_type, full_text, url, source, source_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET updated_at = NOW()
            """, (category_id, title, year, act_type, full_text, url, source, source_id))

            self.db.commit()
        except Exception as e:
            print(f"    ❌ DB Error: {e}")
            self.db.rollback()

    def run_all(self):
        """Run all scrapers"""
        print("🚀 Starting Legislation.gov.uk Scraper\n")
        self.scrape_employment_law()
        self.scrape_statutory_instruments()
        print("\n✅ Legislation.gov.uk scraping complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    import os
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:dev-postgres-password@localhost:5432/iterlaw_knowledge")
    scraper = LegislationScraper(db_string)
    scraper.run_all()
