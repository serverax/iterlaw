'use client';

import { useCallback, useRef, useState } from 'react';

export type AxiomEngineStatus = 'idle' | 'extracting' | 'reasoning' | 'complete' | 'error';

export interface AxiomEngineState {
  status: AxiomEngineStatus;
  message: string;
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
  isLoading: boolean;
}

type ExtractPayload = {
  caseId: string;
  documentText: string;
  currentState?: 'intake' | 'facts_review' | 'reasoning' | 'drafting' | 'complete' | 'escalated';
};

type ReasonPayload = {
  caseId: string;
  jurisdiction?: 'england_wales' | 'scotland' | 'ni';
  facts: Array<{
    id: string;
    label: string;
    value: string;
    confidence?: number;
    sourceSpan?: string;
    userConfirmed?: boolean;
  }>;
  currentState?: 'intake' | 'facts_review' | 'reasoning' | 'drafting' | 'complete' | 'escalated';
};

function parseSseLines(buffer: string): { events: unknown[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events: unknown[] = [];
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    try {
      events.push(JSON.parse(line.slice(6)));
    } catch {
      // skip malformed chunk
    }
  }
  return { events, rest };
}

/**
 * Consumes POST /api/axiom/process (text/event-stream).
 */
export function useAxiomEngine() {
  const [state, setState] = useState<AxiomEngineState>({
    status: 'idle',
    message: '',
    progress: 0,
    isLoading: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const processStream = useCallback(async (payload: ExtractPayload | ReasonPayload) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const isReason = Array.isArray((payload as ReasonPayload).facts);
    setState({
      status: isReason ? 'reasoning' : 'extracting',
      message: 'Starting…',
      progress: 0,
      isLoading: true,
    });

    try {
      const response = await fetch('/api/axiom/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseLines(buffer);
        buffer = rest;

        for (const raw of events) {
          if (!raw || typeof raw !== 'object') continue;
          const event = raw as {
            type: string;
            message?: string;
            progress?: number;
            step?: string;
            result?: Record<string, unknown>;
            escalate?: boolean;
          };

          switch (event.type) {
            case 'init':
              setState((prev) => ({
                ...prev,
                message: event.message ?? prev.message,
                progress: event.progress ?? prev.progress,
                isLoading: true,
              }));
              break;
            case 'progress':
              setState((prev) => ({
                ...prev,
                status: event.step === 'reasoning' ? 'reasoning' : 'extracting',
                message: event.message ?? prev.message,
                progress: event.progress ?? prev.progress,
                isLoading: true,
              }));
              break;
            case 'data':
              setState((prev) => ({
                ...prev,
                progress: event.progress ?? prev.progress,
                isLoading: true,
              }));
              break;
            case 'complete':
              setState({
                status: 'complete',
                message: 'Done',
                progress: 100,
                result: event.result,
                isLoading: false,
              });
              break;
            case 'error':
              setState({
                status: 'error',
                message: event.message ?? 'Error',
                error: event.message,
                progress: 0,
                isLoading: false,
              });
              break;
            default:
              break;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      const message = error instanceof Error ? error.message : 'Request failed';
      setState({
        status: 'error',
        message,
        error: message,
        progress: 0,
        isLoading: false,
      });
    }
  }, []);

  const processExtract = useCallback(
    (payload: ExtractPayload) => processStream(payload),
    [processStream]
  );

  const processReason = useCallback(
    (payload: ReasonPayload) => processStream(payload),
    [processStream]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState({
      status: 'idle',
      message: '',
      progress: 0,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    processStream,
    processExtract,
    processReason,
    cancel,
  };
}
