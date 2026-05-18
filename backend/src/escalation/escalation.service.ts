/**
 * SOLICITOR ESCALATION
 *
 * - Escalate low-confidence questions
 * - Generate case summary PDFs
 * - Notify solicitors
 * - Award loyalty points
 * Adapted to use Supabase.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";

export class EscalationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async escalateQuestion(
    caseId: string,
    questionId: string,
    reason: "low_confidence" | "complex_case" | "user_requested"
  ): Promise<void> {
    const { data: question } = await this.supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    const { data: caseData } = await this.supabase
      .from("cases")
      .select("*, case_timeline_entries(*)")
      .eq("id", caseId)
      .single();

    if (!caseData) throw new Error("Case not found");

    // Generate case summary
    const caseSummaryPdf = await this.generateCaseSummary(caseData);

    // Find available solicitor
    const solicitor = await this.findAvailableSolicitor(caseData.jurisdiction);

    // Create referral
    const { data: referral, error: referralError } = await this.supabase
      .from("solicitor_referrals")
      .insert({
        case_id: caseId,
        question_id: questionId,
        solicitor_id: solicitor.id,
        reason,
        // In a real scenario, upload PDF to Supabase Storage first
        // case_summary_pdf_url: ...
        status: "pending",
      })
      .select("*")
      .single();

    if (referralError) throw referralError;

    // Notify solicitor (Stub)
    console.log(`[ESCALATION] Notifying solicitor ${solicitor.id} for referral ${referral.id}`);

    // Award points (Stub)
    console.log(`[LOYALTY] Awarding 150 points to user ${caseData.user_id} for escalation`);
  }

  private async generateCaseSummary(caseData: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument();
      const chunks: any[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(25).text("Case Summary", 100, 100);
      doc.fontSize(12).text(`Case ID: ${caseData.id}`);
      doc.text(`Jurisdiction: ${caseData.jurisdiction}`);
      doc.text(`Status: ${caseData.status}`);
      
      doc.end();
    });
  }

  private async findAvailableSolicitor(jurisdiction: string): Promise<any> {
    const { data: partners } = await this.supabase
      .from("solicitor_partners")
      .select("*")
      .eq("jurisdiction", jurisdiction)
      .eq("active", true);

    if (!partners || partners.length === 0) {
      // Return a fallback solicitor for dev
      return { id: "fallback-solicitor-id", name: "Legal Help Ltd" };
    }

    return partners[Math.floor(Math.random() * partners.length)];
  }
}
