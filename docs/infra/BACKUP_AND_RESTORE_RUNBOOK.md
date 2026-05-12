# IterLaw — Backup & Restore Runbook

Operational reference for IterLaw's two backup surfaces: source code
(GitHub) and the Postgres + pgvector database (currently a local-PVC
nightly dump). This runbook records what is in place, what is missing,
and the next implementation task to move IterLaw off any single-host
dependency.

This runbook is **documentation only**. It does NOT authorise creating
the remote bucket / Storage Box, sealing any new secret, applying any
manifest, or running `psql` against production.

---

## 1. What must be backed up

| Data class | Where it lives now | Backup status |
| --- | --- | --- |
| Source code | GitHub `serverax/iterlaw.git` (`master`) | PROTECTED — distributed across every operator clone + GitHub itself |
| K8s manifests | Under `k8s/iterlaw/` and `k8s/iterlaw-data/` in this repo | PROTECTED — part of the source tree |
| SealedSecret manifests (encrypted) | `k8s/iterlaw-{ai,data}/secrets/*.yaml` | PROTECTED — sealed at rest; cluster has the private key |
| Raw secret values (the kubeseal inputs) | Operator workstation only | **NOT TRACKED IN GIT** — by policy, NEVER committed |
| Postgres `iterlaw` database | StatefulSet in `iterlaw-data` namespace, PVC-backed | NIGHTLY `pg_dump` to a **local PVC only** |
| `uk_emp_rag.legal_documents` (acts, statutes) | Postgres | Included in the nightly dump |
| `uk_emp_rag.legal_document_chunks` (RAG chunks) | Postgres | Included in the nightly dump |
| `uk_emp_rag.legal_chunk_embeddings` (vectors) | Postgres | Included in the nightly dump |
| `uk_emp_rag.statutory_rate`, `vento_band`, etc. | Postgres | Included in the nightly dump |
| `uk_emp_rag.q_a_cache*` (Q&A cache + sources) | Postgres | Included in the nightly dump |
| `uk_emp_rag.legal_answer_evidence` (audit) | Postgres | Included in the nightly dump |
| `uk_emp_rag.legal_ingestion_runs` (ingestion audit) | Postgres | Included in the nightly dump |
| `rag_runs`, `answer_verification_log`, `verified_answers_cache`, `source_update_log` (101_reconcile tables) | Postgres | Included in the nightly dump |
| Uploaded user documents | NOT IMPLEMENTED YET — no file-upload path in v1 | Will need separate object-storage backup when added |
| Local-only operator files (`.claude/`, `iterlaw.code-workspace`) | Operator workstation only | INTENTIONALLY UNTRACKED — these are harness/IDE state, not product data |

`pg_dump` is currently scoped to `--schema=uk_emp_rag`. That excludes
any `public.*` table from the dump. When the application schema
genuinely lives in `public` (the 001-chain canonical tables), the
dump command needs widening — see §9.

---

## 2. Current state

### 2.1 GitHub (source code)

- Authoritative remote: `https://github.com/serverax/iterlaw.git`
- Local at HEAD `7670227` is in sync with `origin/master` (ahead 0, behind 0).
- A clone + reapply of K8s manifests + a fresh Postgres is sufficient to bring up an empty IterLaw on any cluster.

### 2.2 Local/untracked operator state

- `.claude/` — Claude harness state on this workstation. NOT REPLICATED. Loss is acceptable; the harness rebuilds on next session.
- `iterlaw.code-workspace` — VS Code workspace file. NOT REPLICATED. Loss is acceptable.

Neither contains product data. Both are intentionally untracked.

### 2.3 Postgres backup CronJob (current)

From `k8s/iterlaw-data/backups/cronjob.yaml`:

| Item | Value |
| --- | --- |
| Manifest | `k8s/iterlaw-data/backups/cronjob.yaml` (PVC + CronJob in one file) |
| Namespace | `iterlaw-data` |
| CronJob name | `iterlaw-postgres-backup` |
| Schedule | `15 2 * * *` (02:15 UTC, daily) |
| Concurrency | `Forbid` |
| Job history | 3 successful / 3 failed retained |
| Tool | `pg_dump --format=plain --no-owner --no-privileges --schema=uk_emp_rag` piped through `gzip -9` |
| Output path | `/backups/iterlaw-YYYYMMDDTHHMMSSZ.sql.gz` |
| Output PVC | `iterlaw-postgres-backup` (20 Gi, `ReadWriteOnce`, in-cluster only) |
| Retention | **NONE.** Operator must prune manually. |
| Encryption at rest | Whatever the cluster StorageClass provides; not explicit. |
| Encryption in transit | N/A — no upload. |
| Remote upload | **NOT IMPLEMENTED.** |
| WAL archiving / PITR | NOT CONFIGURED. |
| Credentials | `iterlaw-postgres-credentials` SealedSecret |
| ServiceAccount | `iterlaw-postgres` (no-API Role; bound via `k8s/iterlaw-data/rbac.yaml`) |
| Egress NetworkPolicy | DNS only (per `k8s/iterlaw-data/postgres/networkpolicy.yaml`) — there is no policy that would allow remote upload today |

### 2.4 Backup format gap (must change before remote upload)

`pg_dump --format=plain` is text-only. The next iteration will
switch to `--format=custom` so:

- the output is a single binary file ready for `pg_restore` with
  selective restore (`--list`, `--use-list`),
- the output already includes index and constraint metadata,
- corruption is detectable via the format header.

### 2.5 Restore drill state

**NO drill has ever been executed.** No script exists to run a drill
automatically. Restore today is a manual sequence (see §6 below) — but
it has never been validated against a real dump.

---

## 3. Recommended remote storage options

Pick **one**. Do not implement multiple competing paths.

| Option | Pros | Cons | Suggested config |
| --- | --- | --- | --- |
| **Hetzner Storage Box** (SFTP / Borg) | Cheap (~£3/month for 1 TB), EU-resident, dedup via Borg gives free PITR-like history. | SFTP needs SSH key; Borg needs a binary in the backup image. | 1 TB box, Borg repo at `ssh://uXXXXXX@uXXXXXX.your-storagebox.de:23/./iterlaw-pg`. |
| **Azure Blob Storage** (Cool tier) | Same Azure subscription as the AKS cluster; Workload Identity removes credential rotation; lifecycle rules handle retention; same blast-radius if Azure region fails. | Same blast radius as the cluster if Azure tenant compromise. Slightly higher cost. | Container `iterlaw-pg-backups`, Workload-Identity-bound SA, lifecycle archive at 30d delete at 90d on daily/. |
| **S3-compatible** (R2 / B2 / S3) | Tooling universal (`aws s3`, `restic`, `mc`). Object lock for compliance retention. | Egress fees on AWS S3 (R2/B2 are egress-free). Manual key rotation unless using IAM-RSA / OIDC. | Bucket `iterlaw-pg-backups-prod`, SSE-KMS encryption, lifecycle rules per prefix. |

**Preferred option for IterLaw: Hetzner Storage Box with Borg.**

Reasons:

1. **Geographically independent of the AKS cluster.** Different
   provider, different physical site → genuinely off-cluster.
2. **Cheapest at this scale** (database is < 1 GB compressed).
3. **Borg gives dedup + per-snapshot history + cheap rotation**, which
   matches the proposed 7d / 4w / 12m retention without paying for 19
   copies of the same data.
4. **Encryption at rest is built in.** Borg repos are
   passphrase-encrypted client-side; the Hetzner-side storage never
   sees plaintext.
5. **No vendor lock-in.** A Borg archive is restorable from any host
   with the binary + passphrase.

Azure Blob is the **second choice** and a reasonable picking if the
operator prefers same-cloud billing + Workload Identity. S3 is the
fallback for portability.

---

## 4. Backup design (proposed)

### 4.1 Schedule + retention

| Job | Cron (UTC) | Purpose | Retention |
| --- | --- | --- | --- |
| `iterlaw-postgres-backup` (existing — keep) | `15 2 * * *` | Local on-cluster snapshot (`pg_dump --format=custom`) | 14 daily on the local PVC |
| `iterlaw-postgres-backup-upload` (new) | `45 2 * * *` | Borg upload of that night's dump to the Hetzner Storage Box | Borg prune `--keep-daily 7 --keep-weekly 4 --keep-monthly 12` |
| `iterlaw-postgres-backup-weekly` (new) | `15 3 * * 0` | Sunday: extra full custom dump tagged `weekly-YYYY-WW`; uploaded immediately | Retained by the weekly prune above |
| `iterlaw-postgres-backup-verify` (new) | `0 6 * * 1` | Monday: download the latest Borg archive into a scratch PVC and run `pg_restore --list` + smoke-count queries against a throwaway database | Logs success/failure only |

Each job uses `startingDeadlineSeconds: 600` and
`concurrencyPolicy: Forbid`.

### 4.2 Format + content

- `pg_dump --format=custom --no-owner --no-privileges --schema=uk_emp_rag --schema=public iterlaw`
- The `--schema=public` is **new** vs the current command — it ensures the canonical 001-chain runtime tables are captured.
- Output file: `iterlaw-${TIMESTAMP}.pgcustom` (no `.sql` extension, no plaintext).
- gzip is dropped — `--format=custom` is already compressed.

### 4.3 Encryption

- Borg repository is initialised with `borg init --encryption=repokey-blake2`. The repokey is stored in the SealedSecret `iterlaw-backup-borg` as `BORG_PASSPHRASE`. The Hetzner-side Storage Box never sees plaintext.
- For Azure Blob or S3 alternatives, server-side encryption (SSE-KMS / Microsoft-managed keys) is mandatory.

### 4.4 Backup manifest + checksum

Every successful upload writes a small **manifest** alongside the
archive:

```
iterlaw-${TIMESTAMP}.manifest.json
{
  "archive": "iterlaw-${TIMESTAMP}.pgcustom",
  "started_at": "...",
  "finished_at": "...",
  "schemas": ["uk_emp_rag", "public"],
  "row_counts_sampled": {
    "uk_emp_rag.legal_documents": 1234,
    "uk_emp_rag.legal_document_chunks": 56789,
    "rag_runs": 4321
  },
  "sha256": "...",
  "size_bytes": ...,
  "pg_dump_format": "custom",
  "pg_version": "16.x",
  "iterlaw_release": "<git-sha>"
}
```

The sha256 is computed by the backup pod and committed to the manifest
before upload. The verify job re-computes after download and refuses
to claim success if it differs.

### 4.5 Alerting

- The CronJob's `failedJobsHistoryLimit: 3` keeps three failure logs in-cluster.
- The next implementation must add an **external alert**: at minimum a Telegram bot message or an email via the operator's chosen SMTP relay, fired when (a) a backup CronJob fails, or (b) the verify job's Monday run fails. Alert payload includes the manifest's `archive` filename, the failed-check name, and the cluster identifier. No PII in alerts.

#### Alerting placeholders (this sprint)

The upload + verify CronJobs read three optional environment variables
from the `iterlaw-backup-borg` SealedSecret. Until a sealed value is
provided, all three are `REPLACE_ME_*` placeholders and the alert
branch is a documented no-op (the job logs the *intent* to alert and
exits without invoking any HTTP client).

| Env var                            | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `BACKUP_ALERT_WEBHOOK_URL`         | Generic webhook (Slack, Discord, PagerDuty Events).|
| `BACKUP_ALERT_TELEGRAM_BOT_TOKEN`  | Telegram bot bearer token.                         |
| `BACKUP_ALERT_TELEGRAM_CHAT_ID`    | Telegram chat ID (numeric).                        |

No real values are committed in this repository. The operator seals
real values into `iterlaw-backup-borg` via the kubeseal workflow in
§7 of this document; until then the CronJobs run silently and the
verifier reports the alerting wiring as a `PASS` of "placeholders
present, no real values".

---

## 5. Restore drill (proposed)

Every restore drill is destructive to the drill namespace, never to
production. The procedure:

1. **Create a disposable namespace.** `kubectl create ns iterlaw-restore-drill`.
2. **Apply a copy of the Postgres manifest** into the drill namespace (image, PVC, secret). Use the same image (`pgvector/pgvector:pg16`).
3. **Download the latest Borg archive** into a scratch pod with `borg extract`. Verify the manifest sha256.
4. **Schema check.** `pg_restore --list` against the dump. Confirm `uk_emp_rag.*` + `public.legal_*` schemas are present.
5. **Count key tables.** Drop into a temporary database, run `pg_restore --dbname iterlaw_restore --no-owner --no-privileges /tmp/dump`. Then:
   ```sql
   SELECT (SELECT count(*) FROM uk_emp_rag.legal_documents)        AS docs,
          (SELECT count(*) FROM uk_emp_rag.legal_document_chunks)  AS chunks,
          (SELECT count(*) FROM uk_emp_rag.legal_chunk_embeddings) AS embeddings,
          (SELECT count(*) FROM rag_runs)                          AS rag_runs;
   ```
   Compare against the manifest's `row_counts_sampled`. Allow for the offset between the dump time and the live database now; the drill is a structural check, not a row-by-row diff.
6. **RAG smoke query.** Run a known-good FTS query against `public.legal_chunks` and confirm at least one row returns. (When pgvector retrieval is wired, replace with a vector similarity query.)
7. **Record the drill result.** A row is INSERTed into `answer_verification_log` of the **drill** database with the drill timestamp + outcome. (Or, if a separate audit table is preferred, an `iterlaw_restore_drills` table — schema to be added in the implementation sprint.)
8. **Tear down.** `kubectl delete ns iterlaw-restore-drill`. Never reattach the drill database to `legal-orchestrator`.

The verify CronJob in §4.1 automates steps 3–6 weekly; the full drill including a row-count comparison is a quarterly human-led exercise.

---

## 6. Manual production restore (real incident)

This is the procedure when the production database genuinely needs to
be restored. **No drill.** **No copy-paste — every step is conscious.**

1. **Halt traffic.** `kubectl -n iterlaw-ai scale deploy/legal-orchestrator --replicas=0`.
2. **Capture the current broken state if possible** (so the post-mortem has something to inspect). Snapshot the broken PVC if the StorageClass supports it.
3. **Spin up a NEW Postgres alongside the broken one.** Same StatefulSet manifest but `metadata.name: iterlaw-postgres-restore`.
4. **Restore the chosen Borg archive into the new instance.** Same procedure as the drill steps 3–5, but pointing at `iterlaw-postgres-restore`.
5. **Run the same row-count smoke check.**
6. **Swap the orchestrator's `DATABASE_URL`** to point at the restored host. Operator confirms; the SealedSecret rotation procedure is in `docs/infra/ITERLAW_SECRETS_RUNBOOK.md`.
7. **Scale `legal-orchestrator` back up.** Watch `/ready` until healthy.
8. **Mark the old PVC retain-only.** Do not delete it for 7 days — it's the only forensic record of what went wrong.

---

## 7. What must NEVER be committed

- Any `.sql`, `.sql.gz`, `.pgcustom`, `.dump`, or `.bak` file. Repository size + liability both forbid this.
- Real Postgres credentials (`POSTGRES_PASSWORD`, etc.).
- Hetzner SSH private key.
- Borg passphrase (`BORG_PASSPHRASE`).
- Azure Storage connection strings with the account key inline.
- AWS access keys / SAS tokens.
- Telegram bot tokens. SMTP passwords.

`scripts/infra/verify-iterlaw-repo.sh` and the pre-push diff scan are
the durable guards. Re-run both after any change to the backup CronJob
or its secrets.

---

## 8. Required future implementation

| # | Artefact | Notes |
| --- | --- | --- |
| 1 | `k8s/iterlaw-data/secrets/iterlaw-backup-borg.example.yaml` | SealedSecret template carrying `BORG_PASSPHRASE`, `BORG_REPO`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`. Sealed at commit time. Example file uses `REPLACE_ME_*` placeholders only. |
| 2 | `k8s/iterlaw-data/backups/upload-cronjob.yaml` | New CronJob `iterlaw-postgres-backup-upload`. Mounts the existing `iterlaw-postgres-backup` PVC **read-only**. Image carries `borg`. Pulls credentials from the SealedSecret. Runs `borg create … && borg prune …`. `automountServiceAccountToken: false`. |
| 3 | `k8s/iterlaw-data/backups/upload-networkpolicy.yaml` | NetworkPolicy permitting egress from `app.kubernetes.io/name: iterlaw-postgres-backup-upload` to `your-storagebox.de:23` (Hetzner SFTP). Default-deny everything else. |
| 4 | `k8s/iterlaw-data/backups/verify-cronjob.yaml` | Monday verify job. Pulls the latest Borg archive, runs `pg_restore --list`, runs smoke counts against a temporary scratch database, exits non-zero on any mismatch. |
| 5 | `apps/legal-orchestrator/scripts/restore-from-borg.sh` | Manual restore helper. Wraps the Borg + `pg_restore` sequence in a single supervised script. Refuses to write to the live `iterlaw-postgres` host. |
| 6 | `scripts/infra/verify-iterlaw-backup.sh` | Repo-level verifier: confirms (1) the upload CronJob manifest exists, (2) its SealedSecret reference resolves to a sealed file (not plaintext), (3) the verify CronJob exists, (4) the manual restore script is `chmod +x`. |
| 7 | Telegram/email alert in steps 2 + 4 | Hook to fire on `failed` exit code. Operator chooses transport. Credentials go in the same Borg SealedSecret (or a sibling). |
| 8 | Switch the existing `iterlaw-postgres-backup` CronJob to `pg_dump --format=custom` and include both `uk_emp_rag` and `public` schemas | Single line change in `k8s/iterlaw-data/backups/cronjob.yaml`. Required before upload-cronjob is useful. |

**None of the above is implemented in this commit.** This runbook
defines them as the next sprint's scope.

---

## 9. Acceptance criteria for the next implementation sprint

- [ ] No real secret value is committed at any point. All Borg /
      Hetzner / Azure / S3 credentials live only inside SealedSecret
      payloads.
- [ ] No production database is touched while writing the new
      manifests. The new upload-cronjob is reviewed via
      `kubectl apply --dry-run=server` only, never `kubectl apply`,
      until an operator explicitly authorises.
- [ ] The next-implementation file list (§8) is exhaustive — no extra
      files appear and no listed file is skipped.
- [ ] `scripts/infra/verify-iterlaw-backup.sh` PASSes locally after
      the sprint.
- [ ] A drill (the §5 procedure) is performed end-to-end against the
      first remote upload before the upload-cronjob is promoted to
      run unattended.

---

## 10. Recommended next task

Implement the eight artefacts in §8 in order. The smallest unit of
useful progress is **§8 item 8** (widen `pg_dump` to include
`public.legal_*` + switch to `--format=custom`), because the current
backup is **incomplete** as long as the runtime queries the canonical
public-schema tables.

**Biggest data-loss risk today:** the entire RAG corpus
(`uk_emp_rag.legal_*` + `public.legal_*` once it's populated) is
backed up to **one local PVC inside one AKS cluster**. If the cluster
or its StorageClass is destroyed, every nightly dump is lost. Add
remote upload (§8 items 1–3) before any production traffic begins.
