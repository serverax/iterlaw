import { randomUUID } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export type ChallengeReason = "InvalidProof" | "FraudulentEvidence" | "TimestampMismatch";

export interface DisputeChallenge {
  readonly id: string;
  readonly caseId: string;
  readonly challengerId: string;
  readonly challengedProofHash: string;
  readonly challengeReason: ChallengeReason;
  readonly evidenceNote: string;
  readonly createdAtMs: number;
}

export type ResolutionOutcome = "Upheld" | "Rejected" | "Escalated" | "Appealed";

export interface DisputeResolution {
  readonly challengeId: string;
  readonly outcome: ResolutionOutcome;
  readonly reason: string;
  readonly resolvedAtMs: number;
}

/**
 * Sprint 44 — Case-scoped dispute challenges + automatic resolution stub.
 */
export class WasmDisputeResolutionPhase10Band {
  private readonly challenges = new Map<string, DisputeChallenge>();
  private readonly caseMembers = new Map<string, Set<string>>();
  private readonly resolutions = new Map<string, DisputeResolution>();
  private readonly appeals = new Set<string>();

  constructor(private readonly zone2: Zone2WasmService) {}

  registerCaseMember(caseId: string, userId: string): void {
    const set = this.caseMembers.get(caseId) ?? new Set<string>();
    set.add(userId);
    this.caseMembers.set(caseId, set);
  }

  canViewCase(userId: string, caseId: string): boolean {
    return this.caseMembers.get(caseId)?.has(userId) ?? false;
  }

  createDisputeChallenge(
    caseId: string,
    challengerId: string,
    challengedProofHash: string,
    challengeReason: ChallengeReason,
    evidenceNote: string,
  ): DisputeChallenge {
    if (!this.canViewCase(challengerId, caseId)) {
      throw new Error("challenger not in case");
    }
    const challenge: DisputeChallenge = {
      id: randomUUID(),
      caseId,
      challengerId,
      challengedProofHash,
      challengeReason,
      evidenceNote,
      createdAtMs: Date.now(),
    };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  async evaluateChallenge(challenge: DisputeChallenge): Promise<{ readonly valid: boolean; readonly reason: string }> {
    const remote = await this.zone2.evaluateChallengeRemote(
      challenge.challengedProofHash,
      `${challenge.challengeReason}:${challenge.evidenceNote}`,
    );
    return { valid: remote.valid, reason: remote.reason };
  }

  async resolveDispute(challenge: DisputeChallenge): Promise<DisputeResolution> {
    const verdict = await this.evaluateChallenge(challenge);
    const remote = await this.zone2.evaluateChallengeRemote(
      challenge.challengedProofHash,
      challenge.evidenceNote,
    );
    let outcome: ResolutionOutcome;
    if (remote.escalate) {
      outcome = "Escalated";
    } else if (verdict.valid) {
      outcome = "Rejected";
    } else {
      outcome = challenge.challengeReason === "InvalidProof" ? "Upheld" : "Rejected";
    }
    const resolution: DisputeResolution = {
      challengeId: challenge.id,
      outcome,
      reason: verdict.reason,
      resolvedAtMs: Date.now(),
    };
    this.resolutions.set(challenge.id, resolution);
    return resolution;
  }

  enforceResolution(challengeId: string): ResolutionOutcome | null {
    return this.resolutions.get(challengeId)?.outcome ?? null;
  }

  fileAppeal(challengeId: string, userId: string): boolean {
    const c = this.challenges.get(challengeId);
    if (!c || !this.canViewCase(userId, c.caseId)) {
      return false;
    }
    this.appeals.add(challengeId);
    const existing = this.resolutions.get(challengeId);
    if (existing) {
      this.resolutions.set(challengeId, { ...existing, outcome: "Appealed" });
    }
    return true;
  }

  getChallengesForCase(caseId: string, viewerId: string): readonly DisputeChallenge[] {
    if (!this.canViewCase(viewerId, caseId)) {
      return [];
    }
    return [...this.challenges.values()].filter((c) => c.caseId === caseId);
  }
}
