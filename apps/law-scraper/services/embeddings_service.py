#!/usr/bin/env python3
"""
Generate embeddings for all chunks using Ollama
"""

import requests
import psycopg2
import os

class EmbeddingsService:
    def __init__(self, db_connection_string, ollama_url="http://localhost:11434"):
        self.db = psycopg2.connect(db_connection_string)
        self.cursor = self.db.cursor()
        self.ollama_url = ollama_url

    def generate_all(self):
        """Generate everything"""
        self.generate_legislation_embeddings()
        self.generate_guidance_embeddings()
        self.generate_case_embeddings()

    def generate_legislation_embeddings(self):
        print("🧠 Generating embeddings for legislation chunks\n")
        self.cursor.execute("""
            SELECT lc.id, lc.chunk_text
            FROM legislation_chunks lc
            WHERE lc.id NOT IN (SELECT DISTINCT legislation_chunk_id FROM embeddings)
            ORDER BY lc.id
        """)
        self.process_embeddings(self.cursor.fetchall(), "embeddings", "legislation_chunk_id")

    def generate_guidance_embeddings(self):
        print("\n🧠 Generating embeddings for guidance documents\n")
        self.cursor.execute("""
            SELECT g.id, g.full_text
            FROM guidance g
            WHERE g.id NOT IN (SELECT DISTINCT guidance_id FROM guidance_embeddings)
            ORDER BY g.id
        """)
        self.process_embeddings(self.cursor.fetchall(), "guidance_embeddings", "guidance_id")

    def generate_case_embeddings(self):
        print("\n🧠 Generating embeddings for case law documents\n")
        self.cursor.execute("""
            SELECT c.id, c.full_text
            FROM case_law c
            WHERE c.id NOT IN (SELECT DISTINCT case_id FROM case_embeddings)
            ORDER BY c.id
        """)
        self.process_embeddings(self.cursor.fetchall(), "case_embeddings", "case_id")

    def process_embeddings(self, items, table, fk_col):
        total = len(items)
        for idx, (item_id, text) in enumerate(items, 1):
            if idx % 10 == 0:
                print(f"[{idx}/{total}] Processing {table}...")
            
            # For guidance/case, we might need to chunk on the fly if not already chunked
            chunks = [text] if len(text) < 1500 else [text[:1500]] # Simplified for now

            for chunk in chunks:
                embedding = self.get_embedding(chunk)
                if embedding and len(embedding) == 768:
                    try:
                        self.cursor.execute(f"INSERT INTO {table} ({fk_col}, chunk_text, embedding) VALUES (%s, %s, %s)",
                                            (item_id, chunk, embedding))
                        self.db.commit()
                    except:
                        self.db.rollback()

    def run_all(self):
        print("🚀 Starting Embeddings Service\n")
        self.generate_all()
        print("\n✅ Embeddings generation complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    import os
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:TestPassword123456789!@127.0.0.1:5433/iterlaw_knowledge")
    ollama_url = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
    service = EmbeddingsService(db_string, ollama_url)
    service.run_all()
