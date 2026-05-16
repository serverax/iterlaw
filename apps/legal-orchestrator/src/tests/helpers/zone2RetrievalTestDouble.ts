import { Zone2RetrievalServiceStub } from "../../coherentSystem/zone2RetrievalStub.js";
import type { Zone2RetrievalService } from "../../coherentSystem/zone2RetrievalTypes.js";

/** Partial Zone 2 overrides with defaults from {@link Zone2RetrievalServiceStub}. */
export function delegatingZone2Retrieval(overrides: Partial<Zone2RetrievalService> = {}): Zone2RetrievalService {
  const base = new Zone2RetrievalServiceStub();
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in overrides) {
        return Reflect.get(overrides as object, prop, receiver);
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(target) : v;
    },
  }) as Zone2RetrievalService;
}
