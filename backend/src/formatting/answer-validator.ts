/**
 * ANSWER STRUCTURE VALIDATOR
 *
 * Enforces:
 * 1. Three-part structure (Law, Meaning, Action)
 * 2. Legislation citations required
 * 3. Applied to user's situation
 * 4. One concrete action (not a list)
 * 5. Banned language detection
 */

export interface ValidatedAnswer {
  valid: boolean;
  law_section: string;
  meaning: string;
  action: string;
  errors: string[];
  warnings: string[];
  confidence_score: number;
}

export class AnswerValidator {
  private BANNED_PHRASES = [
    /^you should/i,
    /\byou should\b/i,
    /^we recommend/i,
    /\bwe recommend\b/i,
    /in my opinion/i,
    /i advise/i,
    /you must/i,
    /you ought to/i,
  ];

  validate(rawAnswer: string): ValidatedAnswer {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Parse three parts
    const parts = this.parseThreeParts(rawAnswer);
    if (!parts) {
      return {
        valid: false,
        law_section: "",
        meaning: "",
        action: "",
        errors: ["Cannot parse into three parts (Law / Meaning / Action)"],
        warnings: [],
        confidence_score: 0,
      };
    }

    // Validate each part
    if (!this.isValidLawSection(parts.law, errors)) {
      errors.push("Law section must cite specific legislation");
    }

    if (!this.isValidMeaning(parts.meaning, errors)) {
      errors.push("Meaning must be applied to user's situation");
    }

    if (!this.isValidAction(parts.action, errors)) {
      errors.push("Action must be one concrete step, not a list");
    }

    // Check for banned language
    if (this.containsBannedLanguage(rawAnswer, errors)) {
      errors.push("Contains banned language");
    }

    // Warnings
    if (parts.law.length < 50) {
      warnings.push("Law section is very brief");
    }

    const valid = errors.length === 0;
    const confidenceScore = valid ? 0.95 : Math.max(0, 0.5 - errors.length * 0.1);

    return {
      valid,
      law_section: parts.law,
      meaning: parts.meaning,
      action: parts.action,
      errors,
      warnings,
      confidence_score: confidenceScore,
    };
  }

  private parseThreeParts(raw: string): { law: string; meaning: string; action: string } | null {
    const lawMatch = raw.match(
      /(?:WHAT THE LAW SAYS|LEGAL POSITION|THE LAW):?\s*\n+([\s\S]*?)(?=WHAT THIS MEANS|MEANING FOR YOU|YOUR SITUATION|$)/i
    );

    const meaningMatch = raw.match(
      /(?:WHAT THIS MEANS FOR YOU|YOUR SITUATION|THIS MEANS|HOW THIS APPLIES):?\s*\n+([\s\S]*?)(?=WHAT TO DO|ACTION|NEXT STEPS|$)/i
    );

    const actionMatch = raw.match(
      /(?:WHAT TO DO TONIGHT|NEXT STEPS|ACTION|YOUR NEXT STEP):?\s*\n+([\s\S]*?)(?=SOURCE|CITATION|$)/i
    );

    if (!lawMatch || !meaningMatch || !actionMatch) {
      return null;
    }

    return {
      law: lawMatch[1].trim(),
      meaning: meaningMatch[1].trim(),
      action: actionMatch[1].trim(),
    };
  }

  private isValidLawSection(section: string, errors: string[]): boolean {
    const hasLegislation = /((Act|Regulation|Code|Rule|Law|Directive|Section)\s)/i.test(section);
    if (!hasLegislation) {
      errors.push("No legislation reference");
      return false;
    }

    const hasNumber = /\b(section|article|para|s\.)\s*\d+/i.test(section);
    if (!hasNumber) {
      errors.push("No section number");
      return false;
    }

    if (section.length < 50) {
      errors.push("Law section too brief");
      return false;
    }

    return true;
  }

  private isValidMeaning(section: string, errors: string[]): boolean {
    const isApplied = /\b(you|your|in your case|this means)\b/i.test(section);
    if (!isApplied) {
      errors.push("Not applied to user");
      return false;
    }

    if (section.length < 30) {
      errors.push("Meaning too brief");
      return false;
    }

    return true;
  }

  private isValidAction(section: string, errors: string[]): boolean {
    const startsWithAction = /^(contact|write|gather|document|call|send|file|apply|save)/i.test(section);
    if (!startsWithAction) {
      errors.push("Action doesn't start with verb");
      return false;
    }

    const isList = /^\s*[-•*]\s/m.test(section);
    if (isList) {
      errors.push("Action is a list");
      return false;
    }

    const isNumberedList = /^\s*\d+\.\s/m.test(section);
    if (isNumberedList) {
      errors.push("Action is numbered list");
      return false;
    }

    if (section.length < 20 || section.length > 200) {
      errors.push("Action length incorrect");
      return false;
    }

    return true;
  }

  private containsBannedLanguage(text: string, errors: string[]): boolean {
    for (const phrase of this.BANNED_PHRASES) {
      if (phrase.test(text)) {
        errors.push(`Banned phrase: "${phrase.source}"`);
        return true;
      }
    }
    return false;
  }
}
