#!/usr/bin/env python3
"""
Chunk all legislation and create RAG-friendly chunks
"""

import psycopg2
import re
import os

class ChunkingService:
    def __init__(self, db_connection_string):
        self.db = psycopg2.connect(db_connection_string)
        self.cursor = self.db.cursor()

    def chunk_legislation(self):
        """Chunk all legislation into RAG-friendly pieces"""
        print("📂 Chunking all legislation for RAG\n")

        # Get all legislation without chunks yet
        self.cursor.execute("""
            SELECT l.id, l.title, l.full_text
            FROM legislation l
            WHERE l.id NOT IN (SELECT DISTINCT legislation_id FROM legislation_chunks)
            LIMIT 100
        """)

        legislation = self.cursor.fetchall()
        total = len(legislation)

        for idx, (leg_id, title, full_text) in enumerate(legislation, 1):
            print(f"[{idx}/{total}] Chunking: {title}")

            # Split into chunks (500 words each)
            chunks = self.split_into_chunks(full_text, chunk_size=500)

            for chunk_order, chunk_text in enumerate(chunks):
                try:
                    self.cursor.execute("""
                        INSERT INTO legislation_chunks
                        (legislation_id, chunk_order, chunk_text)
                        VALUES (%s, %s, %s)
                    """, (leg_id, chunk_order, chunk_text))
                    self.db.commit()
                except Exception as e:
                    print(f"  ❌ Error: {e}")
                    self.db.rollback()

            print(f"  ✅ {len(chunks)} chunks created")

    def split_into_chunks(self, text: str, chunk_size: int = 500) -> list:
        """Split text into semantic chunks"""
        # Remove XML/HTML tags
        if not text: return []
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()

        words = text.split()
        chunks = []
        current_chunk = []

        for word in words:
            current_chunk.append(word)
            if len(current_chunk) >= chunk_size:
                chunks.append(' '.join(current_chunk))
                current_chunk = []

        if current_chunk:
            chunks.append(' '.join(current_chunk))

        return chunks

    def run_all(self):
        print("🚀 Starting Chunking Service\n")
        self.chunk_legislation()
        print("\n✅ Chunking complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:dev-postgres-password@localhost:5432/iterlaw_knowledge")
    service = ChunkingService(db_string)
    service.run_all()
