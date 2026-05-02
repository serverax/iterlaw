import type { GovAPIResult } from '@/lib/gov-apis/types';
import { formatAnswer } from './formatter';
import type { UserContext, ValidationResult } from './types';
import { govResultToAnswerSource } from './types';
import { validateAnswer } from './validator';

export async function validateAndFormatAnswer(
  question: string,
  govApiResults: GovAPIResult[],
  userContext?: UserContext
): Promise<ValidationResult> {
  void question;

  if (!govApiResults || govApiResults.length === 0) {
    return {
      passed: false,
      confidence: 0,
      errors: ['No Government API results found. Escalating to AI...'],
      escalate: true,
    };
  }

  const topResult = govApiResults[0];
  if (!topResult) {
    return {
      passed: false,
      confidence: 0,
      errors: ['No Government API results found. Escalating to AI...'],
      escalate: true,
    };
  }

  const source = govResultToAnswerSource(topResult);
  const formatted = formatAnswer(source, userContext);
  const validation = validateAnswer(formatted);

  return {
    ...validation,
    formatted: validation.passed ? formatted : undefined,
  };
}
