# Cruser: DevOps handoff — accuracy baseline

**Branch:** `phase0/step7-qa-pool`  
**Pinning a SHA:** use **`git rev-parse HEAD`** after pull (doc-only commits change the tip often).  
**Recent doc commits:** **`6083eaf`** — handoff commit table (baseline file = **`7f6a926`**) + baseline **`59a9609`** changelog; later tip commits add PR cite wording + “corrections” link under **Three linked docs** in the handoff.  
**Earlier:** **`59a9609`** — citation + `test.yml` / `build.yml` not per-push/PR  
**Baseline file landed:** **`7f6a926`** — created this doc + cross-links from handoff and `.github/DEVOPS.md`  
**Handoff rewrite:** **`84b29e4`** — eight-workflow table, double-CI note, backup/S3 path, `test:ci` vs `npm run ci`  
**Status:** Matches repository behaviour at branch tip (verify with **`git rev-parse HEAD`**)  

**Primary handoff (operators):** [`CRUSER_DEVOPS_CICD_HANDOFF.md`](./CRUSER_DEVOPS_CICD_HANDOFF.md)  
**Contributor setup:** [`.github/DEVOPS.md`](../.github/DEVOPS.md)

This file records **five** corrections that had appeared in earlier drafts so nobody reintroduces them.

---

## Correction 1: eight workflows (not six + two docs)

**Wrong:** Treating `docs/CRUSER_DEVOPS_CICD_HANDOFF.md` or `.github/DEVOPS.md` as “workflow 7–8.”

**Right:** **Eight** workflows = eight files under `.github/workflows/`:

1. `ci.yml`  
2. `pull-request.yml`  
3. `ci-reusable.yml`  
4. `test.yml`  
5. `build.yml`  
6. `deploy-staging.yml`  
7. `deploy-production.yml`  
8. `backup.yml`  

`test.yml` is **weekly + manual** (`workflow_dispatch`); `build.yml` is **manual only**. They are not part of every push/PR event — unlike `ci.yml` and `pull-request.yml`.

Documentation is not executable CI.

---

## Correction 2: PR + push = two full CI runs (not one shared `npm ci`)

**Wrong:** Implying that because `ci-reusable.yml` is shared, only one `npm ci` runs for a PR update.

**Right:** `push` and `pull_request` are **different events** → **different workflow runs** → each run executes **`npm ci`** inside its own job. Sharing the YAML avoids **duplicating step definitions**; it does **not** merge GitHub Actions minutes across events.

**Why it matters:** billing and expectations (~two similar durations per push to an open PR targeting `master`).

---

## Correction 3: no custom PR comment from Actions

**Wrong:** “Optional PR comment with test results” in `pull-request.yml`.

**Right:** There is **no** workflow step that posts a summary comment. Use **Checks**, **Actions logs**, and optionally **Codecov** (if configured).

---

## Correction 4: backup format and secret name

**Wrong:** Plain `YYYY-MM-DD.sql` text dump; secret name `AWS_BUCKET`.

**Right (from `backup.yml`):**

- Local file: `backup.dump` from `pg_dump … --format=custom`.  
- Upload: `s3://${{ secrets.AWS_BACKUP_BUCKET }}/$(date -u +%Y-%m-%d)/rightsnow.dump`  

There is **no** extra `backups/` path segment in the workflow — object key is **`{date}/rightsnow.dump`**` under the bucket root.

Restore in production is typically `pg_restore` against a custom-format dump (operator runbook, not defined in YAML).

---

## Correction 5: branch protection must match check names exactly

**Wrong:** Assuming generic names like `ci` or `pull-request` will always satisfy branch protection.

**Right:** In **Settings → Branches → Rules**, required checks must match the **exact** names shown on the PR **Checks** tab (often **CI** and **PR Validation**, but verify per repo).

If names do not match, failed workflows may not block merge.

---

## What changed in commit `84b29e4`

- **`docs/CRUSER_DEVOPS_CICD_HANDOFF.md`** — Rewritten with the eight workflows, double-CI honesty, backup/S3 details, `test:ci` vs `npm run ci`, suggested PR blurb.  
- **`.github/DEVOPS.md`** — Note on two CI runs + troubleshooting row.

---

## What changed in commit `7f6a926`

- **`docs/CRUSER_DEVOPS_ACCURACY_BASELINE.md`** — Created (this file): the five corrections in one place.  
- **`docs/CRUSER_DEVOPS_CICD_HANDOFF.md`** — Links here; audience table lists three linked docs.  
- **`.github/DEVOPS.md`** — Link under the title to this baseline.

---

## What changed in commit `59a9609`

- **`docs/CRUSER_DEVOPS_ACCURACY_BASELINE.md`** — Header now distinguishes `84b29e4` / `7f6a926` / `59a9609`; note that `test.yml` and `build.yml` are **not** per-push/per-PR.  
- **`docs/CRUSER_DEVOPS_CICD_HANDOFF.md`** — “Three linked docs” heading; baseline line clarified (bundle vs rewrites).

---

## What changed in commit `6083eaf`

- **`docs/CRUSER_DEVOPS_CICD_HANDOFF.md`** — Commit history table (newest first); **baseline file** correctly attributed to **`7f6a926`** (not `84b29e4`).  
- **`docs/CRUSER_DEVOPS_ACCURACY_BASELINE.md`** — Header roles for `59a9609` / `7f6a926` / `84b29e4`; **`59a9609`** changelog subsection added.

---

## Operator checklist (push / PR / merge)

1. **Local:** `npm run ci` (and `npm run build` if you want extra confidence).  
2. **Push:** `git push -u origin phase0/step7-qa-pool`.  
3. **PR:** expect **CI** (push) and **PR Validation** (`pull_request`) as separate runs when both events fire.  
4. **After merge:** set GitHub **variables** / **secrets** per `.github/DEVOPS.md`; align branch protection with real check names.

---

## Optional follow-up

A separate **narrative** appendix (cost table, long-form “day in the life”) can live in another doc **only** if the team wants it — keep **technical authority** in `CRUSER_DEVOPS_CICD_HANDOFF.md` and this baseline so there is a single source of truth.
