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
| `public.legal_cases` (102_add_legal_cases_table — UK case-law ingestion target) | Postgres | Included in the nightly dump |
| Uploaded user documents | NOT IMPLEMENTED YET — no file-upload path in v1 | Will need separate object-storage backup when added |
| Local-only operator files (`.claude/`, `iterlaw.code-workspace`) | Operator workstation only | INTENTIONALLY UNTRACKED — these are harness/IDE state, not product data |

**Update (2026-05-12):** `pg_dump` has already been widened. The
current `k8s/iterlaw-data/backups/cronjob.yaml` now runs
`pg_dump --format=custom --no-owner --no-privileges --schema=public`
unconditionally and adds `--schema=uk_emp_rag` only when a `psql`
probe confirms the schema exists. The `public` schema (which holds
the 001-chain canonical tables plus the new `public.legal_cases`
from migration 102) is therefore always captured. The §2.4 gap
that motivated this widening is now closed.

---

## 2. Current state

### 2.1 GitHub (source code)

- Authoritative remote: `https://github.com/serverax/iterlaw.git`.
- The working tree on the operator workstation may be **ahead of `origin/master`** during in-progress sprints. The protected copy is the one on GitHub, not the local clone — never depend on the workstation copy.
- A clone + reapply of K8s manifests + a fresh Postgres is sufficient to bring up an empty IterLaw on any cluster. Verify by `git ls-remote https://github.com/serverax/iterlaw.git master` and comparing against the last operator-confirmed SHA.

### 2.2 Local/untracked operator state

- `.claude/` — Claude harness state on this workstation. NOT REPLICATED. Loss is acceptable; the harness rebuilds on next session.
- `iterlaw.code-workspace` — VS Code workspace file. NOT REPLICATED. Loss is acceptable.

Neither contains product data. Both are intentionally untracked.

### 2.3 Postgres backup CronJob (current — `iterlaw-postgres-backup`)

From `k8s/iterlaw-data/backups/cronjob.yaml`:

| Item | Value |
| --- | --- |
| Manifest | `k8s/iterlaw-data/backups/cronjob.yaml` (PVC + CronJob in one file) |
| Namespace | `iterlaw-data` |
| CronJob name | `iterlaw-postgres-backup` |
| Schedule | `15 2 * * *` (02:15 UTC, daily) |
| Concurrency | `Forbid` |
| Job history | 3 successful / 3 failed retained |
| Tool | `pg_dump --format=custom --no-owner --no-privileges --schema=public` plus conditional `--schema=uk_emp_rag` when present |
| Output path | `/backups/iterlaw-YYYYMMDDTHHMMSSZ.dump` |
| Output PVC | `iterlaw-postgres-backup` (20 Gi, `ReadWriteOnce`, in-cluster only) |
| Local retention | **NONE.** Operator must prune `/backups` manually. Borg upload (see §2.4) handles remote retention. |
| Encryption at rest | Whatever the cluster StorageClass provides; not explicit. Borg upload adds client-side encryption for the remote copy. |
| Encryption in transit | N/A on the local dump; SSH+Borg for the upload. |
| Remote upload | **MANIFEST DRAFTED — not yet applied.** See §2.4. |
| WAL archiving / PITR | NOT CONFIGURED. |
| Credentials | `iterlaw-postgres-credentials` SealedSecret |
| ServiceAccount | `iterlaw-postgres` (no-API Role; bound via `k8s/iterlaw-data/rbac.yaml`) |
| Egress NetworkPolicy | DNS only on the Postgres pod itself; the upload pod has a separate (draft) policy in `upload-networkpolicy.yaml` |

### 2.4 Borg upload + verify CronJobs (drafted, not yet applied)

The remote-backup path is **drafted in repo** but no manifest has
been applied to the cluster yet. Each YAML carries
`iterlaw.io/status: draft-not-applied`.

| Manifest | Purpose | Status |
| --- | --- | --- |
| `k8s/iterlaw-data/backups/upload-cronjob.yaml` | Nightly Borg upload of the latest `iterlaw-*.dump` to a Hetzner Storage Box. Mounts the backup PVC **read-only**. `automountServiceAccountToken: false`. Schedule `15 3 * * *`. | Draft. Image placeholder is `ghcr.io/serverax/iterlaw-backup-uploader:REPLACE_ME_DIGEST_OR_TAG` — must be replaced with a digest pin before any `kubectl apply`. |
| `k8s/iterlaw-data/backups/upload-networkpolicy.yaml` | Egress allow-list for the upload pod: DNS + SSH on port 23 to the Storage Box. | Draft. Carries `iterlaw.io/policy-todo: "pin Storage Box /32 CIDR before apply"`. The `to.ipBlock.cidr` is currently `0.0.0.0/0`, which is wider than acceptable for production. |
| `k8s/iterlaw-data/backups/verify-cronjob.yaml` | Weekly restore-verification drill (Mondays 06:00 UTC). Lists the Borg repo, runs `borg check --verify-data`, extracts the latest archive, runs `pg_restore --list` against the extracted dump, asserts both `public` + `uk_emp_rag` schemas. Does **NOT** restore into a live database. | Draft. Same image-placeholder constraint. |
| `k8s/iterlaw-data/secrets/iterlaw-backup-borg.example.yaml` | Template Secret carrying `REPLACE_ME_*` placeholders for `BORG_REPO`, `BORG_PASSPHRASE`, `STORAGEBOX_HOST`, `STORAGEBOX_USER`, `SSH_PRIVATE_KEY`, plus optional alert envs. Not a SealedSecret — the operator runs `kubeseal` over the filled-in copy. | Example only. Never applied directly. |
| `apps/backup-uploader/` | Source for the image referenced by both CronJobs. Alpine 3.20 + `borg`, `openssh-client`, `postgresql16-client`, `tini`. Non-root UID 70. | Source-present; image not yet built or pushed. |
| `scripts/infra/build-backup-uploader-image.sh` | Helper to build (and optionally `--push`) the uploader image. Reports `DOCKER_NOT_AVAILABLE` if docker is missing. | Implemented. Not executed in any sprint to date. |
| `scripts/infra/create-backup-borg-sealedsecret-template.sh` | Helper that reads `BORG_REPO`, `BORG_PASSPHRASE`, etc. from the environment and emits a raw Secret YAML to stdout (or `--kubeseal`-pipes it). Refuses `REPLACE_ME` and empty values. | Implemented. Not executed in any sprint to date. |
| `apps/legal-orchestrator/scripts/restore-from-borg.sh` | Manual restore helper. Requires `FORCE_RESTORE=1` and refuses to touch anything matching `iterlaw-postgres.iterlaw-data.svc.cluster.local`. | Implemented. Never executed against a real archive (no archive exists yet). |
| `scripts/infra/verify-iterlaw-backup.sh` | Repo-level verifier: 26 static checks across cronjobs, networkpolicy, example secret, restore script. | Implemented. Current state: PARTIAL — 25 PASS, 1 WARN on the broad CIDR. |

### 2.5 Restore drill state

**NO drill has ever been executed against a real archive.** All
drill machinery is drafted but unrun. The `verify-cronjob.yaml`
is the closest piece of "automated drill" we will have once the
uploader image is built and the secret is sealed.

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

### 8.1 Already implemented (do NOT redo)

| # | Artefact | Where |
| --- | --- | --- |
| ✓ | Local nightly `pg_dump --format=custom` covering `public` + conditional `uk_emp_rag` | `k8s/iterlaw-data/backups/cronjob.yaml` |
| ✓ | Borg upload CronJob (draft, not applied) | `k8s/iterlaw-data/backups/upload-cronjob.yaml` |
| ✓ | Storage-Box egress NetworkPolicy (draft, not applied) | `k8s/iterlaw-data/backups/upload-networkpolicy.yaml` |
| ✓ | Weekly verify CronJob (draft, not applied) | `k8s/iterlaw-data/backups/verify-cronjob.yaml` |
| ✓ | Example Secret template with `REPLACE_ME_*` placeholders | `k8s/iterlaw-data/secrets/iterlaw-backup-borg.example.yaml` |
| ✓ | Uploader image source | `apps/backup-uploader/` (Dockerfile + entrypoint.sh + README.md) |
| ✓ | Image build script | `scripts/infra/build-backup-uploader-image.sh` |
| ✓ | SealedSecret generator script | `scripts/infra/create-backup-borg-sealedsecret-template.sh` |
| ✓ | Manual restore helper with FORCE_RESTORE guard + production-host refusal | `apps/legal-orchestrator/scripts/restore-from-borg.sh` |
| ✓ | Repo-level verifier with 26 static checks | `scripts/infra/verify-iterlaw-backup.sh` |
| ✓ | SealedSecret workflow doc | `k8s/iterlaw-data/secrets/README.md` |
| ✓ | Alerting placeholders in upload + verify CronJobs | `BACKUP_ALERT_WEBHOOK_URL`, `BACKUP_ALERT_TELEGRAM_BOT_TOKEN`, `BACKUP_ALERT_TELEGRAM_CHAT_ID` |

### 8.2 Still required before any production traffic

| # | Artefact | Notes |
| --- | --- | --- |
| 1 | **Build + push the uploader image** | Run `bash scripts/infra/build-backup-uploader-image.sh --push` from an environment that has Docker and a `docker login` to the chosen registry. Capture the resulting `@sha256:` digest. |
| 2 | **Pin the digest in both CronJob manifests** | Replace `image: ghcr.io/serverax/iterlaw-backup-uploader:REPLACE_ME_DIGEST_OR_TAG` with `image: ghcr.io/serverax/iterlaw-backup-uploader@sha256:<digest>` in `upload-cronjob.yaml` and `verify-cronjob.yaml`. The verifier asserts this before promotion. |
| 3 | **Resolve the Storage Box IP and pin the CIDR** | Replace `0.0.0.0/0` in `upload-networkpolicy.yaml` with `<storagebox-ip>/32`. CNI must enforce NetworkPolicy (Cilium / Calico — not the default k3s flannel). |
| 4 | **Generate and seal the real `iterlaw-backup-borg` Secret** | Run the SealedSecret generator script with real env vars, pipe through `kubeseal`, commit only the resulting `*-sealedsecret.yaml`. The raw `.raw.yaml` MUST be `shred -u`'d. |
| 5 | **Apply the four backup manifests in dry-run, then in production** | `kubectl apply --dry-run=server -f k8s/iterlaw-data/backups/`, review, then unattended apply on operator authorisation. |
| 6 | **Provide real alert values** | Seal `BACKUP_ALERT_WEBHOOK_URL` (Slack / Discord / PagerDuty) OR `BACKUP_ALERT_TELEGRAM_BOT_TOKEN`+`BACKUP_ALERT_TELEGRAM_CHAT_ID` into the same SealedSecret. The current pods log alert *intent* only; an upgrade to fire a `curl` call is a small TODO inside `apps/backup-uploader/entrypoint.sh`. |
| 7 | **First end-to-end drill** | After §5 succeeds for one night, run the §5-of-this-doc procedure (extract latest archive, `pg_restore --list`, smoke counts) end-to-end against a throwaway namespace. Record the result in operator notes. The weekly `verify-cronjob` automates most of this from there onward. |
| 8 | **Storage Box DNS resolver script** | Small helper `scripts/infra/resolve-storagebox-ip.sh` to translate `uXXXXXX.your-storagebox.de` to a stable `/32` (Hetzner publishes a stable IP per box). Used as a pre-apply step for the NetworkPolicy. Listed but optional — operator can also paste the IP by hand once. |

**None of the §8.2 items has been executed yet.** Items 1–4 are
prerequisites for §8.2 item 5. Item 6 is independent and can land
in any later sprint without blocking 1–5.

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

The §8.1 inventory is complete in source. The §8.2 list is what
moves IterLaw off single-PVC dependency.

**The single most useful next task is §8.2 item 1 + 2 together:**
build + push the uploader image, capture its sha256 digest, and pin
that digest into both `upload-cronjob.yaml` and `verify-cronjob.yaml`.
The four backup manifests are otherwise non-applicable (no image
exists at the placeholder location). Once items 1–2 land, item 4
(real SealedSecret) becomes possible, item 3 (CIDR pin) is a one-line
operator action, and item 5 (apply) unblocks every downstream step.

**Biggest data-loss risk today:** every dump produced by the nightly
CronJob lives **only on a single 20 Gi `ReadWriteOnce` PVC inside
the cluster**. Cluster destruction, StorageClass corruption, or
namespace deletion loses every backup. The upload-cronjob manifest
is drafted but **not applied** because the image it references does
not yet exist — the placeholder tag `REPLACE_ME_DIGEST_OR_TAG` is a
deliberate defense to prevent an early apply. Until §8.2 items 1–5
are complete, the cluster is the single point of failure for the
entire RAG corpus and every audit table this runbook lists in §1.

**Acceptance for "remote-protected":**

- A Borg archive named `iterlaw-YYYYMMDDTHHMMSSZ` exists in the
  Hetzner Storage Box repo, dated within the last 25 hours.
- `borg check --verify-data` against that archive PASSes.
- `pg_restore --list` against the extracted dump shows both
  `SCHEMA - public` and (if populated) `SCHEMA - uk_emp_rag`.
- `verify-iterlaw-backup.sh` reports `summary: PASS (0 warn)` (the
  current 1-WARN on the broad CIDR has been closed by §8.2 item 3).
