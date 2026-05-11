// Model router (Phase 11). Pure function. The actual gateway call lives elsewhere
// (not in this skeleton). Output names match the Ollama models the operator says
// are loaded on the OrdinoxAI cluster, but this file does NOT contact Ollama.

import type { Classification, ModelRole } from "../types/legal.js";

export interface ModelSelection {
  role: ModelRole;
  ollama_model: string;     // Tag as it appears in `ollama list`
  temperature: number;
  max_tokens: number;
}

export function selectModel(classification: Classification): ModelSelection {
  switch (classification.recommended_model_role) {
    case "uk_employment_qa":
      return {
        role: "uk_employment_qa",
        ollama_model: "uk-employment-qwen:latest",
        temperature: 0.15,
        max_tokens: 1200,
      };
    case "uk_employment_document":
      return {
        role: "uk_employment_document",
        // Same family, distinct spec model intended for document review. If the
        // tag doesn't exist on the cluster, the gateway call (not in scope here)
        // must fall back to uk-employment-qwen and log the substitution.
        ollama_model: "uk-employment-document",
        temperature: 0.10,
        max_tokens: 1600,
      };
    case "uk_employment_drafting":
      return {
        role: "uk_employment_drafting",
        ollama_model: "uk-employment-drafting",
        temperature: 0.25,
        max_tokens: 2000,
      };
    case "heavy_reasoning":
      return {
        role: "heavy_reasoning",
        ollama_model: "mistral-nemo:12b",
        temperature: 0.20,
        max_tokens: 2400,
      };
    case "coding":
      return {
        role: "coding",
        ollama_model: "qwen2.5-coder:7b",
        temperature: 0.10,
        max_tokens: 1600,
      };
    case "fast_classifier":
    default:
      // For unknown/clarification flow — small model, low temperature.
      return {
        role: "fast_classifier",
        ollama_model: "qwen3:1.7b",
        temperature: 0.05,
        max_tokens: 400,
      };
  }
}
