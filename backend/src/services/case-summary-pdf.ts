import PDFDocument from 'pdfkit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

const logger = new Logger('CaseSummaryPDF');

export type CaseSummaryInput = {
  caseId: string;
  userId: string;
  jurisdiction: string;
  situationType?: string;
  serviceMonths?: number;
  timeline: Array<{ date: string; event: string }>;
  questions: Array<{ id: string; text: string; source?: string; confidence?: number }>;
};

export async function generateCaseSummaryPDF(caseId: string, sb?: SupabaseClient): Promise<Buffer> {
  if (sb) {
    const { data: caseData } = await sb.from('cases').select('*').eq('id', caseId).single();
    if (!caseData) throw new Error(`Case not found: ${caseId}`);

    const { data: timeline } = await sb
      .from('case_timeline')
      .select('created_at,description')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    const { data: questions } = await sb
      .from('answers')
      .select('question_text,source')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(20);

    return generateCaseSummaryPdf({
      caseId,
      userId: String(caseData.user_id ?? ''),
      jurisdiction: String(caseData.jurisdiction ?? 'England and Wales'),
      situationType: String(caseData.situation_type ?? ''),
      serviceMonths: Number(caseData.service_months ?? 0),
      timeline: (timeline ?? []).map((t) => ({
        date: new Date(String(t.created_at)).toLocaleDateString(),
        event: String(t.description),
      })),
      questions: (questions ?? []).map((q, i) => ({
        id: `q${i}`,
        text: String(q.question_text),
        source: String(q.source ?? 'unknown'),
      })),
    });
  }

  return generateCaseSummaryPdf({
    caseId,
    userId: 'unknown',
    jurisdiction: 'England and Wales',
    timeline: [],
    questions: [],
  });
}

export async function generateCaseSummaryPdf(input: CaseSummaryInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('CASE SUMMARY', { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(`Case ID: ${input.caseId}`);
    doc.text(`Jurisdiction: ${input.jurisdiction}`);
    if (input.situationType) doc.text(`Situation: ${input.situationType}`);
    if (input.serviceMonths) doc.text(`Service Length: ${input.serviceMonths} months`);
    doc.moveDown();

    doc.fontSize(14).text('CASE TIMELINE', { underline: true });
    doc.moveDown();
    if (input.timeline.length === 0) {
      doc.fontSize(10).text('No timeline events recorded.');
    } else {
      for (const entry of input.timeline) {
        doc.fontSize(10).text(`${entry.date}: ${entry.event}`);
      }
    }
    doc.moveDown();

    doc.fontSize(14).text('QUESTIONS ANSWERED', { underline: true });
    doc.moveDown();
    if (input.questions.length === 0) {
      doc.fontSize(10).text('No questions answered yet.');
    } else {
      for (const q of input.questions) {
        doc.fontSize(10).text(`• ${q.text} [${q.source ?? 'n/a'}]`);
      }
    }
    doc.moveDown();
    doc.fontSize(14).text('NEXT STEPS', { underline: true });
    doc.fontSize(11).text('This case requires solicitor review. Contact a qualified employment lawyer.');
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.end();
  });
}

export async function saveCaseSummaryPDF(
  caseId: string,
  userId: string,
  sb: SupabaseClient
): Promise<string> {
  const pdfBuffer = await generateCaseSummaryPDF(caseId, sb);
  const filename = `case-summary-${caseId}-${Date.now()}.pdf`;
  const { error } = await sb.from('case_documents').insert({
    case_id: caseId,
    user_id: userId,
    filename,
    url: `stub://${filename}`,
    type: 'summary_pdf',
  });
  if (error) logger.warn('case_documents insert skipped', { error: error.message });
  logger.info(`Generated case summary PDF: ${filename}`);
  return filename;
}
