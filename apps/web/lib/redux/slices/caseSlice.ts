import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface CaseState {
  currentCaseId: string | null;
  caseData: Record<string, unknown> | null;
  timeline: Array<Record<string, unknown>>;
  answers: Array<Record<string, unknown>>;
  loading: boolean;
  error: string | null;
}

const initialState: CaseState = {
  currentCaseId: null,
  caseData: null,
  timeline: [],
  answers: [],
  loading: false,
  error: null,
};

export const caseSlice = createSlice({
  name: 'case',
  initialState,
  reducers: {
    setCurrentCase: (state, action: PayloadAction<string>) => {
      state.currentCaseId = action.payload;
    },
    setCaseData: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.caseData = action.payload;
    },
    addTimelineEntry: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.timeline.push(action.payload);
    },
    addAnswer: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.answers.push(action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearCase: (state) => {
      state.currentCaseId = null;
      state.caseData = null;
      state.timeline = [];
      state.answers = [];
      state.error = null;
    },
  },
});

export const {
  setCurrentCase,
  setCaseData,
  addTimelineEntry,
  addAnswer,
  setLoading,
  setError,
  clearCase,
} = caseSlice.actions;

export default caseSlice.reducer;
