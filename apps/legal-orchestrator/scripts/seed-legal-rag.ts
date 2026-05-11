// seed-legal-rag.ts
//
// Small wrapper that prints the operator commands needed to apply the
// minimal RAG seed against a real database. Intentionally does NOT
// execute SQL itself — applying a migration / seed against a live cluster
// is an operator-confirmed action.
//
// Usage:
//   npx tsx apps/legal-orchestrator/scripts/seed-legal-rag.ts
// or (after build):
//   node apps/legal-orchestrator/dist/scripts/seed-legal-rag.js
//
// Exit codes:
//   0 — printed the instructions
//   2 — invoked with --execute (intentionally blocked; this file refuses)

import path from "node:path";

const SEED_SQL = path.join(
  "apps",
  "legal-orchestrator",
  "db",
  "seeds",
  "seed_legal_rag_minimal.sql"
);
const MIGRATION_SQL = path.join(
  "apps",
  "legal-orchestrator",
  "db",
  "migrations",
  "001_legal_rag_foundation.sql"
);

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--execute")) {
    process.stderr.write(
      "seed-legal-rag.ts refuses to execute against a live database.\n" +
        "Apply manually via psql or kubectl exec; see the commands below.\n"
    );
    process.exit(2);
  }

  const lines: string[] = [];
  lines.push("OrdinoxAI legal RAG seed — operator commands");
  lines.push("");
  lines.push("1) Apply the schema migration (idempotent):");
  lines.push(`   psql \"$DATABASE_URL\" -f ${MIGRATION_SQL}`);
  lines.push("");
  lines.push("2) Apply the minimal seed (idempotent):");
  lines.push(`   psql \"$DATABASE_URL\" -f ${SEED_SQL}`);
  lines.push("");
  lines.push("3) Verify chunk count:");
  lines.push(
    "   psql \"$DATABASE_URL\" -c \"SELECT count(*) FROM legal_chunks WHERE is_active=true;\""
  );
  lines.push("");
  lines.push("Alternative (inside K3s pod):");
  lines.push(
    "   kubectl -n ordinox-ai exec -i deploy/postgres-pgvector -- psql -U ordinox_legal -d ordinox_legal_ai < " +
      MIGRATION_SQL
  );
  lines.push(
    "   kubectl -n ordinox-ai exec -i deploy/postgres-pgvector -- psql -U ordinox_legal -d ordinox_legal_ai < " +
      SEED_SQL
  );
  lines.push("");
  lines.push(
    "This script does NOT execute SQL itself. Run the commands above with the appropriate credentials."
  );

  process.stdout.write(lines.join("\n") + "\n");
}

main();
