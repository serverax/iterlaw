/**
 * DEADLINE SERVICE
 *
 * - Auto-generate from situation
 * - Track status
 * - Send alerts at 7 days
 * Adapted to use Supabase.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, differenceInDays } from "date-fns";

export interface Deadline {
  id: string;
  case_id: string;
  description: string;
  due_date: Date;
  days_remaining: number;
  status: "upcoming" | "due_soon" | "overdue";
  alert_sent: boolean;
}

export class DeadlineService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async generateDeadlines(caseId: string, situationType: string): Promise<Deadline[]> {
    const now = new Date();
    const deadlines = [];

    if (situationType === "dismissal") {
      // ACAS early conciliation: 3 months
      deadlines.push({
        description: "ACAS Early Conciliation deadline",
        due_date: addMonths(now, 3),
      });

      // Employment tribunal: 6 months from now
      deadlines.push({
        description: "Employment Tribunal claim deadline",
        due_date: addMonths(now, 6),
      });
    }

    if (situationType === "discrimination") {
      deadlines.push({
        description: "Claim deadline (3 months)",
        due_date: addMonths(now, 3),
      });
    }

    const results = [];
    for (const d of deadlines) {
      const { data, error } = await this.supabase
        .from("deadlines")
        .insert({
          case_id: caseId,
          ...d,
        })
        .select("*")
        .single();
      
      if (!error) results.push(data as Deadline);
    }
    
    return results;
  }

  async checkAndAlertDeadlines(): Promise<void> {
    const { data: allDeadlines, error } = await this.supabase
      .from("deadlines")
      .select("*")
      .eq("alert_sent", false);

    if (error || !allDeadlines) return;

    for (const deadline of allDeadlines as Deadline[]) {
      const daysLeft = differenceInDays(new Date(deadline.due_date), new Date());

      if (daysLeft <= 7) {
        // Send notification
        await this.notifyUser(deadline.case_id, deadline);

        // Mark as alerted
        await this.supabase
          .from("deadlines")
          .update({ alert_sent: true })
          .eq("id", deadline.id);
      }
    }
  }

  private async notifyUser(caseId: string, deadline: Deadline): Promise<void> {
    // Stub for notification logic (email/push)
    console.log(`[ALERT] Deadline approaching for case ${caseId}: ${deadline.description}`);
  }
}
