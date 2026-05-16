import { Zone2WorkspaceServiceStub } from "../../coherentSystem/zone2WorkspaceStub.js";
import type { Zone2WorkspaceService } from "../../coherentSystem/zone2WorkspaceTypes.js";

export function delegatingZone2Workspace(overrides: Partial<Zone2WorkspaceService> = {}): Zone2WorkspaceService {
  const base = new Zone2WorkspaceServiceStub();
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in overrides) {
        return Reflect.get(overrides as object, prop, receiver);
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(target) : v;
    },
  }) as Zone2WorkspaceService;
}
