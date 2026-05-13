// Sprint 12B truth-reconciliation guard tests.
//
// These tests verify that the IterLaw sprint-status documents do not
// re-introduce the contradictions that Sprint 12B reconciled:
//
//   1. Sprint 10 must not be marked "PENDING" or "PARTIAL" while another
//      section in the same active-status doc claims Sprint 10 PASS.
//   2. Sprint 11 must not be marked "BLOCKED" or "NOT STARTED" while another
//      section in the same active-status doc claims Sprint 11 PASS.
//   3. The "Completed: 10" / "Completed: 15" mismatch in the canonical status
//      file must stay reconciled.
//
// These are doc-consistency tests, not unit tests for any code module.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf-8');
}

describe('IterLaw sprint truth consistency (Sprint 12B reconciliation guard)', () => {
  describe('docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md (canonical)', () => {
    const status = read('docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md');

    it('does not mark Sprint 11 as UNBLOCKED / NOT STARTED in active status', () => {
      expect(status).not.toMatch(/Sprint 11.*UNBLOCKED \/ READY TO START/i);
      expect(status).not.toMatch(/Sprint 11.*NOT STARTED/i);
    });

    it('does not say Completed: 10 (the file uses scoped completed=15 count)', () => {
      expect(status).not.toMatch(/\*\*Completed:\*\*\s*\*\*10\*\*\s*\(Sprints 1–10\)/);
    });

    it('does not list Sprint 11 as the current sprint', () => {
      expect(status).not.toMatch(/\*\*Current sprint:\*\*\s*\*\*Sprint 11\*\*/);
    });

    it('lists Sprint 10 as PASS in the gate state section', () => {
      expect(status).toMatch(/Sprint 10 overall:\s*\*\*PASS\*\*/);
    });

    it('lists Sprint 11 as PASS in the gate state section', () => {
      // The leading bullet for Sprint 11 must declare PASS, not UNBLOCKED.
      expect(status).toMatch(/Sprint 11:\s*\*\*PASS\*\*/);
    });
  });

  describe('docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md', () => {
    const roadmap = read('docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md');

    it('does not mark Sprint 10 real staging DB verification as PENDING', () => {
      expect(roadmap).not.toMatch(/Sprint 10 real staging DB verification:\s*\*\*PENDING\*\*/i);
    });

    it('does not mark Sprint 11 live HTTP transport as NOT STARTED', () => {
      expect(roadmap).not.toMatch(/Sprint 11 live HTTP transport:\s*\*\*NOT STARTED\*\*/i);
    });

    it('does not mark Sprint 11 pipeline wiring as NOT STARTED', () => {
      expect(roadmap).not.toMatch(/Sprint 11 pipeline wiring:\s*\*\*NOT STARTED\*\*/i);
    });

    it('does not declare Sprint 11 BLOCKED', () => {
      expect(roadmap).not.toMatch(/Sprint 11 remains\s*\*\*BLOCKED\*\*/i);
    });

    it('points readers to SPRINT_INDEX.md as the authoritative source', () => {
      expect(roadmap).toMatch(/SPRINT_INDEX\.md/);
    });
  });

  describe('docs/iterlaw/project/07-sprints/SPRINT_INDEX.md (authoritative)', () => {
    const idx = read('docs/iterlaw/project/07-sprints/SPRINT_INDEX.md');

    it('marks Sprint 10 PASS', () => {
      expect(idx).toMatch(/Sprint 10[^\n]*\*\*PASS\*\*/);
    });

    it('marks Sprint 11 PASS', () => {
      expect(idx).toMatch(/Sprint 11[^\n]*\*\*PASS\*\*/);
    });
  });
});
