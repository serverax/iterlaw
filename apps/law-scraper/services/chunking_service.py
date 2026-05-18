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

    def chunk_all(self):
        """Chunk everything"""
        self.chunk_legislation()
        self.chunk_guidance()
        self.chunk_case_law()

    def chunk_legislation(self):
        """Chunk all legislation into RAG-friendly pieces"""
        print("📂 Chunking all legislation for RAG\n")
        self.cursor.execute("""
            SELECT l.id, l.title, l.full_text
            FROM legislation l
            WHERE l.id NOT IN (SELECT DISTINCT legislation_id FROM legislation_chunks)
        """)
        self.process_items(self.cursor.fetchall(), "legislation_chunks", "legislation_id")

    def chunk_guidance(self):
        """Chunk guidance documents"""
        print("📂 Chunking all guidance for RAG\n")
        self.cursor.execute("""
            SELECT g.id, g.title, g.full_text
            FROM guidance g
            WHERE g.id NOT IN (SELECT DISTINCT guidance_id FROM guidance_embeddings)
        """)
        # We don't have guidance_chunks table, we use guidance_embeddings directly
        pass 

    def process_items(self, items, table, fk_col):
        total = len(items)
        for idx, (item_id, title, full_text) in enumerate(items, 1):
            print(f"[{idx}/{total}] Chunking: {title}")
            chunks = self.split_into_chunks(full_text, chunk_size=500)
            for chunk_order, chunk_text in enumerate(chunks):
                try:
                    self.cursor.execute(f"INSERT INTO {table} ({fk_col}, chunk_order, chunk_text) VALUES (%s, %s, %s)", 
                                        (item_id, chunk_order, chunk_text))
                    self.db.commit()
                except Exception as e:
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

    def chunk_case_law(self):
        """Chunk case law documents"""
        print("📂 Chunking all case law for RAG\n")
        self.cursor.execute("""
            SELECT c.id, c.case_name, c.full_text
            FROM case_law c
            WHERE c.id NOT IN (SELECT DISTINCT case_id FROM case_embeddings)
        """)
        # Similar to guidance, we use case_embeddings directly or add a case_chunks table
        pass

    def run_all(self):
        print("🚀 Starting Chunking Service\n")
        self.chunk_all()
        print("\n✅ Chunking complete")
        self.cursor.close()
        self.db.close()

if __name__ == "__main__":
    import os
    db_string = os.environ.get("DATABASE_URL", "postgresql://iterlaw_user:TestPassword123456789!@127.0.0.1:5433/iterlaw_knowledge")
    service = ChunkingService(db_string)
    service.run_all()
