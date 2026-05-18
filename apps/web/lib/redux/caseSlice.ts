export type CaseState = {
  caseId: string | null;
  questionCount: number;
  lastAnswerPreview: string | null;
};

export const initialCaseState: CaseState = {
  caseId: null,
  questionCount: 0,
  lastAnswerPreview: null,
};

export type CaseAction =
  | { type: 'case/setCaseId'; payload: string }
  | { type: 'case/incrementQuestions' }
  | { type: 'case/setAnswerPreview'; payload: string }
  | { type: 'case/reset' };

export function caseReducer(state: CaseState, action: CaseAction): CaseState {
  switch (action.type) {
    case 'case/setCaseId':
      return { ...state, caseId: action.payload };
    case 'case/incrementQuestions':
      return { ...state, questionCount: state.questionCount + 1 };
    case 'case/setAnswerPreview':
      return { ...state, lastAnswerPreview: action.payload };
    case 'case/reset':
      return initialCaseState;
    default:
      return state;
  }
}
