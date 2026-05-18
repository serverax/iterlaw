/**
 * CASE MANAGEMENT SERVICE
 *
 * Tracks: case metadata, timeline events, status
 * Adapted to use Supabase instead of Prisma.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface Case {
  id: string;
  user_id: string;
  situation_type: "disciplinary" | "dismissal" | "discrimination" | "redundancy" | "wages" | "health_safety";
  jurisdiction: "england_wales" | "scotland" | "ni";
  service_months: number;
  created_at: Date;
  updated_at: Date;
  status: "active" | "resolved" | "closed";
}

export interface CaseEvent {
  id: string;
  case_id: string;
  event_type: "question_asked" | "document_uploaded" | "deadline_created" | "escalation";
  event_data: Record<string, any>;
  timestamp: Date;
}

export class CaseService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async createCase(
    userId: string,
    situation: {
      type: Case["situation_type"];
      jurisdiction: Case["jurisdiction"];
      service_months: number;
    }
  ): Promise<Case> {
    const { data, error } = await this.supabase
      .from("cases")
      .insert({
        user_id: userId,
        situation_type: situation.type,
        jurisdiction: situation.jurisdiction,
        service_months: situation.service_months,
        status: "active",
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as Case;
  }

  async getCase(caseId: string): Promise<Case & { events: CaseEvent[] }> {
    const { data: caseData, error: caseError } = await this.supabase
      .from("cases")
      .select("*, case_timeline_entries(*)")
      .eq("id", caseId)
      .single();

    if (caseError) throw caseError;
    
    // Map timeline entries to events if needed
    return {
      ...caseData,
      events: caseData.case_timeline_entries || []
    } as any;
  }

  async addEventToCase(
    caseId: string,
    event: {
      type: CaseEvent["event_type"];
      data: Record<string, any>;
    }
  ): Promise<CaseEvent> {
    const { data, error } = await this.supabase
      .from("case_timeline_entries")
      .insert({
        case_id: caseId,
        event_type: event.type,
        event_data: event.data,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as CaseEvent;
  }

  async getTimeline(caseId: string): Promise<CaseEvent[]> {
    const { data, error } = await this.supabase
      .from("case_timeline_entries")
      .select("*")
      .eq("case_id", caseId)
      .order("timestamp", { ascending: false });

    if (error) throw error;
    return data as CaseEvent[];
  }

  async updateCaseStatus(
    caseId: string,
    status: Case["status"]
  ): Promise<Case> {
    const { data, error } = await this.supabase
      .from("cases")
      .update({ status, updated_at: new Date() })
      .eq("id", caseId)
      .select("*")
      .single();

    if (error) throw error;
    return data as Case;
  }

  async closeCase(caseId: string): Promise<Case> {
    return this.updateCaseStatus(caseId, "closed");
  }

  async getOrCreateActiveCase(
    userId: string,
    defaultSituation?: {
      type: Case["situation_type"];
      jurisdiction: Case["jurisdiction"];
      service_months: number;
    }
  ): Promise<Case> {
    const { data: activeCase, error } = await this.supabase
      .from("cases")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;

    if (!activeCase && defaultSituation) {
      return await this.createCase(userId, defaultSituation);
    }

    return activeCase as Case;
  }
}
