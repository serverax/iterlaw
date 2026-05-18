import PDFDocument from 'pdfkit';

export type CaseSummaryInput = {
  caseId: string;
  userId: string;
  jurisdiction: string;
  timeline: Array<{ date: string; event: string }>;
  questions: Array<{ id: string; text: string; confidence?: number }>;
};

export async function generateCaseSummaryPdf(input: CaseSummaryInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('IterLaw Case Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Case ID: ${input.caseId}`);
    doc.text(`User ID: ${input.userId}`);
    doc.text(`Jurisdiction: ${input.jurisdiction}`);
    doc.moveDown();
    doc.fontSize(14).text('Timeline');
    for (const entry of input.timeline) {
      doc.fontSize(11).text(`• ${entry.date}: ${entry.event}`);
    }
    doc.moveDown();
    doc.fontSize(14).text('Questions');
    for (const q of input.questions) {
      const conf = q.confidence != null ? ` (${Math.round(q.confidence * 100)}%)` : '';
      doc.fontSize(11).text(`• ${q.text}${conf}`);
    }
    doc.end();
  });
}
