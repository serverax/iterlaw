import { Zone2WasmServiceStub } from "../../coherentSystem/zone2WasmStub.js";
import type { Zone2WasmService } from "../../coherentSystem/zone2WasmTypes.js";

export function delegatingZone2Wasm(overrides: Partial<Zone2WasmService> = {}): Zone2WasmService {
  const base = new Zone2WasmServiceStub();
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in overrides) {
        return Reflect.get(overrides as object, prop, receiver);
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(target) : v;
    },
  }) as Zone2WasmService;
}
