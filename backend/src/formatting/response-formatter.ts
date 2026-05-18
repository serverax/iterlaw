/**
 * RESPONSE FORMATTER
 *
 * Formats validated answer into final response for frontend
 */

import { ValidatedAnswer } from "./answer-validator";

export interface SourceCitation {
  citation: string;
  url: string;
  type: "govuk" | "legislation" | "acas" | "caselaw" | "ai";
}

export interface ResponseMetadata {
  question_id: string;
  case_id: string;
  model_used: "ollama" | "gemini" | "claude";
  response_time_ms: number;
}

export interface FormattedResponse {
  question_id: string;
  case_id: string;

  law: {
    label: "WHAT THE LAW SAYS";
    text: string;
    icon: "⚖️";
  };

  meaning: {
    label: "WHAT THIS MEANS FOR YOU";
    text: string;
    icon: "💡";
  };

  action: {
    label: "WHAT TO DO TONIGHT";
    text: string;
    icon: "✓";
  };

  source: {
    citation: string;
    url: string;
    type: "govuk" | "legislation" | "acas" | "caselaw" | "ai";
    tap_text: "View source";
  };

  metadata: {
    confidence_score: number;
    model_used: "ollama" | "gemini" | "claude";
    response_time_ms: number;
    timestamp: string;
    citations_locked: boolean;
  };
}

export class ResponseFormatter {
  format(
    validatedAnswer: ValidatedAnswer,
    source: SourceCitation,
    metadata: ResponseMetadata
  ): FormattedResponse {
    return {
      question_id: metadata.question_id,
      case_id: metadata.case_id,

      law: {
        label: "WHAT THE LAW SAYS",
        text: validatedAnswer.law_section,
        icon: "⚖️",
      },

      meaning: {
        label: "WHAT THIS MEANS FOR YOU",
        text: validatedAnswer.meaning,
        icon: "💡",
      },

      action: {
        label: "WHAT TO DO TONIGHT",
        text: validatedAnswer.action,
        icon: "✓",
      },

      source: {
        citation: source.citation,
        url: source.url,
        type: source.type,
        tap_text: "View source",
      },

      metadata: {
        confidence_score: validatedAnswer.confidence_score,
        model_used: metadata.model_used,
        response_time_ms: metadata.response_time_ms,
        timestamp: new Date().toISOString(),
        citations_locked: true,  // ALWAYS true
      },
    };
  }
}
