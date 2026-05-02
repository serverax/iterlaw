import type { UserAnswer } from '@/lib/validation/types';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

/**
 * Build a downloadable Word document summarising a validated answer (informational).
 */
export async function buildAnswerDocxBuffer(answer: UserAnswer): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'RightsNow — Employment law summary',
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [new TextRun({ text: 'What the law says', bold: true })],
          }),
          new Paragraph({ children: [new TextRun(answer.law)] }),
          new Paragraph({
            children: [new TextRun({ text: 'What this means for you', bold: true })],
          }),
          new Paragraph({ children: [new TextRun(answer.meaning)] }),
          new Paragraph({
            children: [new TextRun({ text: 'Practical next steps', bold: true })],
          }),
          new Paragraph({ children: [new TextRun(answer.action)] }),
          new Paragraph({
            children: [new TextRun({ text: 'Source', bold: true })],
          }),
          new Paragraph({
            children: [
              new TextRun(`${answer.source.citation}${answer.source.url ? ` — ${answer.source.url}` : ''}`),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Model confidence: ${answer.confidence.toFixed(2)}`, italics: true })],
          }),
          ...(answer.disclaimer
            ? [
                new Paragraph({
                  children: [new TextRun({ text: 'Disclaimer', bold: true })],
                }),
                new Paragraph({ children: [new TextRun(answer.disclaimer)] }),
              ]
            : []),
        ],
      },
    ],
  });

  const out = await Packer.toBuffer(doc);
  return Buffer.from(out);
}
