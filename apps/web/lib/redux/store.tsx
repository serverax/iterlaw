'use client';

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { caseReducer, initialCaseState, type CaseAction, type CaseState } from './caseSlice';

type Store = {
  case: CaseState;
  dispatch: (action: CaseAction) => void;
};

const CaseStoreContext = createContext<Store | null>(null);

export function CaseStoreProvider({ children }: { children: ReactNode }) {
  const [caseState, dispatch] = useReducer(caseReducer, initialCaseState);
  return (
    <CaseStoreContext.Provider value={{ case: caseState, dispatch }}>
      {children}
    </CaseStoreContext.Provider>
  );
}

export function useCaseStore(): Store {
  const ctx = useContext(CaseStoreContext);
  if (!ctx) throw new Error('useCaseStore must be used within CaseStoreProvider');
  return ctx;
}
