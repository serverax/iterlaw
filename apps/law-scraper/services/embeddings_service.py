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

    def generate_all_embeddings(self):
        """Generate embeddings for all chunks"""
        print("🧠 Generating embeddings for all chunks\n")

        # Get chunks without embeddings
        self.cursor.execute("""
            SELECT lc.id, lc.chunk_text
            FROM legislation_chunks lc
            WHERE lc.id NOT IN (SELECT DISTINCT legislation_chunk_id FROM embeddings)
            ORDER BY lc.id
        """)

        chunks = self.cursor.fetchall()
        total = len(chunks)

        for idx, (chunk_id, chunk_text) in enumerate(chunks, 1):
            if idx % 50 == 0:
                print(f"[{idx}/{total}] Generating embeddings...")

            embedding = self.get_embedding(chunk_text)

            if embedding and len(embedding) == 1536:
                try:
                    self.cursor.execute("""
                        INSERT INTO embeddings (legislation_chunk_id, embedding)
                        VALUES (%s, %s)
                    """, (chunk_id, embedding))
                    self.db.commit()
                except Exception as e:
                    print(f"❌ Error: {e}")
                    self.db.rollback()

        print(f"\n✅ Generated {total} embeddings")

    def get_embedding(self, text: str):
        """Get embedding from Ollama"""
        try:
            response = requests.post(
                f"{self.ollama_url}/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text},
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                return data.get('embedding', [])
        except Exception as e:
            print(f"❌ Embedding error: {e}")

        return []

    def run_all(self):
        print("🚀 Starting Embeddings Service\n")
        self.generate_all_embeddings()
        print("\n✅ Embeddings generation complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:dev-postgres-password@localhost:5432/iterlaw_knowledge")
    ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    service = EmbeddingsService(db_string, ollama_url)
    service.run_all()
