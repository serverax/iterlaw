"use strict";
/** @rightsnow/legal-core — deterministic legal pipeline (AEE/ART/LVC/SEA) + UK constants */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIDENT_THRESHOLD = exports.buildSeaInputFromLvc = exports.runSeaPhase = exports.buildEnqueuePayloadFromPipeline = exports.runAxiomPipeline = exports.lvcConfidenceBand = exports.verifyLegalOutput = void 0;
__exportStar(require("./legal/constants/ukEmploymentRates2026"), exports);
__exportStar(require("./legal/rules/unfairDismissalTransition"), exports);
__exportStar(require("./legal/rules/fireAndRehire"), exports);
__exportStar(require("./legal/rules/zeroHoursReferencePeriod"), exports);
__exportStar(require("./legal/rules/payAuditTriggers"), exports);
var legalVerificationController_1 = require("./axiom/lvc/legalVerificationController");
Object.defineProperty(exports, "verifyLegalOutput", { enumerable: true, get: function () { return legalVerificationController_1.verifyLegalOutput; } });
Object.defineProperty(exports, "lvcConfidenceBand", { enumerable: true, get: function () { return legalVerificationController_1.lvcConfidenceBand; } });
var runAxiomPipeline_1 = require("./axiom/orchestrator/runAxiomPipeline");
Object.defineProperty(exports, "runAxiomPipeline", { enumerable: true, get: function () { return runAxiomPipeline_1.runAxiomPipeline; } });
Object.defineProperty(exports, "buildEnqueuePayloadFromPipeline", { enumerable: true, get: function () { return runAxiomPipeline_1.buildEnqueuePayloadFromPipeline; } });
var runSeaPhase_1 = require("./axiom/sea/runSeaPhase");
Object.defineProperty(exports, "runSeaPhase", { enumerable: true, get: function () { return runSeaPhase_1.runSeaPhase; } });
Object.defineProperty(exports, "buildSeaInputFromLvc", { enumerable: true, get: function () { return runSeaPhase_1.buildSeaInputFromLvc; } });
Object.defineProperty(exports, "CONFIDENT_THRESHOLD", { enumerable: true, get: function () { return runSeaPhase_1.CONFIDENT_THRESHOLD; } });
