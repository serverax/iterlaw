# Agentic Algorithm Specification (Sovereign Agent Grid 3.0)

**Component:** Core Reasoning Engine  
**Language:** Python (Agents) + Go (Orchestration) + Rust (Validation)  
**Status:** SPECIFICATION (design reference only; not asserted production-ready)

---

## PART 1: TEMPORAL.IO WORKFLOW STATE MACHINE

### 1.1 Workflow Definition (Go + Temporal SDK)

```go
package orchestration

import (
    "go.temporal.io/sdk/client"
    "go.temporal.io/sdk/workflow"
)

// CasePayload is the input to the workflow
type CasePayload struct {
    CaseID          string
    AnonymizedText  string
    Jurisdiction    string
    LegalDomain     string
    UserPersona     string
    TokenReferences []string // e.g., ["DATE_1", "EMPLOYEE_1"]
}

// FinalResponse is the output
type FinalResponse struct {
    CaseID             string
    AnonymizedAdvice   string
    Citations          []string
    ConfidenceScore    float32
    ExecutionTime      int64 // milliseconds
}

// LegalAnalysisWorkflow is the main state machine
func LegalAnalysisWorkflow(ctx workflow.Context, payload CasePayload) (*FinalResponse, error) {
    logger := workflow.GetLogger(ctx)
    logger.Info("Workflow started", "caseID", payload.CaseID)

    // Timeout + retry policy
    options := workflow.ActivityOptions{
        StartToCloseTimeout: time.Minute * 10,
        RetryPolicy: &temporal.RetryPolicy{
            InitialInterval:    time.Second * 2,
            BackoffCoefficient: 2.0,
            MaximumAttempts:    3, // Retry up to 3 times
        },
    }
    ctx = workflow.WithActivityOptions(ctx, options)

    // ========== STATE 1: INTAKE ==========
    logger.Info("STATE 1: INTAKE - Parsing user intent", "caseID", payload.CaseID)
    
    var intakeOutput IntakeOutput
    err := workflow.ExecuteActivity(ctx, IntakeAgentActivity, payload).Get(ctx, &intakeOutput)
    if err != nil {
        logger.Error("Intake failed", "error", err)
        return nil, err
    }
    
    // Record state in audit trail
    workflow.ExecuteActivity(ctx, AuditLogActivity, payload.CaseID, "INTAKE_COMPLETE", intakeOutput)

    // ========== STATE 2: RESEARCH ==========
    logger.Info("STATE 2: RESEARCH - Querying databases", "caseID", payload.CaseID)
    
    var researchOutput ResearchOutput
    err = workflow.ExecuteActivity(ctx, ResearcherAgentActivity, 
        intakeOutput, 
        payload.Jurisdiction).Get(ctx, &researchOutput)
    if err != nil {
        logger.Error("Research failed", "error", err)
        return nil, err
    }
    
    workflow.ExecuteActivity(ctx, AuditLogActivity, payload.CaseID, "RESEARCH_COMPLETE", researchOutput)

    // ========== STATE 3: DRAFTING (With Forensic Loop) ==========
    logger.Info("STATE 3: DRAFTING - Generating legal advice", "caseID", payload.CaseID)
    
    var finalDraft *DraftOutput
    var isValid bool = false
    var attempts int = 0
    
    // Retry loop: Keep drafting until Forensic Gatekeeper approves
    for !isValid && attempts < 3 {
        attempts++
        logger.Info("Drafting attempt", "caseID", payload.CaseID, "attempt", attempts)
        
        var draft DraftOutput
        err := workflow.ExecuteActivity(ctx, DraftingAgentActivity, 
            intakeOutput, 
            researchOutput).Get(ctx, &draft)
        
        if err != nil {
            logger.Error("Drafting failed", "error", err)
            return nil, err
        }
        
        // ========== STATE 4: FORENSIC VALIDATION ==========
        logger.Info("STATE 4: FORENSIC - Validating citations", 
            "caseID", payload.CaseID, "attempt", attempts)
        
        var validationResult ForensicOutput
        err = workflow.ExecuteActivity(ctx, ForensicGatekeeperActivity, 
            draft, 
            researchOutput).Get(ctx, &validationResult)
        
        if err != nil {
            logger.Error("Forensic validation failed", "error", err)
            return nil, err
        }
        
        if validationResult.IsValid {
            isValid = true
            finalDraft = &draft
            logger.Info("Forensic validation PASSED", "caseID", payload.CaseID, "attempt", attempts)
        } else {
            logger.Warn("Forensic validation FAILED - Hallucination detected", 
                "caseID", payload.CaseID, 
                "issue", validationResult.ErrorMessage,
                "attempt", attempts)
            
            // Signal drafting agent to retry with stricter constraints
            workflow.ExecuteActivity(ctx, AuditLogActivity, payload.CaseID, 
                "HALLUCINATION_DETECTED", validationResult.ErrorMessage)
        }
    }
    
    if !isValid {
        logger.Error("Forensic validation failed after 3 attempts", "caseID", payload.CaseID)
        return nil, workflow.NewApplicationError("hallucination_unresolvable", "Could not generate valid advice")
    }

    // ========== STATE 5: COMPLETION ==========
    logger.Info("STATE 5: COMPLETION - Preparing response", "caseID", payload.CaseID)
    
    response := &FinalResponse{
        CaseID:           payload.CaseID,
        AnonymizedAdvice: finalDraft.Text,
        Citations:        finalDraft.Citations,
        ConfidenceScore:  finalDraft.ConfidenceScore,
        ExecutionTime:    workflow.Now(ctx).Sub(workflow.Now(ctx)).Milliseconds(),
    }
    
    workflow.ExecuteActivity(ctx, AuditLogActivity, payload.CaseID, "WORKFLOW_COMPLETE", response)
    
    logger.Info("Workflow completed successfully", "caseID", payload.CaseID)
    return response, nil
}
```

---

## PART 2: AGENT IMPLEMENTATIONS (Python + LangGraph)

### 2.1 Intake Agent

```python
# Location: apps/legal-orchestrator/src/agents/intake_agent.py

from pydantic import BaseModel
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_anthropic import ChatAnthropic
import json

class IntakeInput(BaseModel):
    case_id: str
    anonymized_text: str
    jurisdiction: str
    legal_domain: str

class IntakeOutput(BaseModel):
    intent: str  # e.g., "Unfair Dismissal"
    jurisdiction: str  # e.g., "UK_EMPLOYMENT"
    user_persona: str  # e.g., "EMPLOYEE"
    key_dates: list[str]  # Extracted dates (anonymized tokens)
    confidence: float  # 0.0 to 1.0

def intake_agent(input: IntakeInput) -> IntakeOutput:
    """
    Phase 1: Understand the user's legal intent from anonymized text.
    
    No database calls here. Pure NLP intent extraction.
    """
    
    llm = ChatAnthropic(model="claude-opus", temperature=0.3)
    
    prompt = f"""
    Analyze this anonymized legal grievance and extract:
    1. The core legal intent (e.g., Unfair Dismissal, Constructive Dismissal)
    2. Jurisdiction (UK_EMPLOYMENT, US_EMPLOYMENT, etc.)
    3. User persona (EMPLOYEE, EMPLOYER, REPRESENTATIVE)
    4. Key dates (as they appear in text, e.g., [DATE_1], [DATE_2])
    
    STRICTLY use only the text provided. Make no assumptions.
    
    Text: {input.anonymized_text}
    
    Respond in JSON format:
    {{
        "intent": "...",
        "jurisdiction": "...",
        "user_persona": "...",
        "key_dates": [...],
        "confidence": 0.95
    }}
    """
    
    response = llm.invoke(prompt)
    result = json.loads(response.content)
    
    return IntakeOutput(
        intent=result["intent"],
        jurisdiction=result["jurisdiction"],
        user_persona=result["user_persona"],
        key_dates=result["key_dates"],
        confidence=result["confidence"]
    )
```

### 2.2 Researcher Agent

```python
# Location: apps/legal-orchestrator/src/agents/researcher_agent.py

from milvus import Collection, connections
import neo4j
from pydantic import BaseModel

class ResearchInput(BaseModel):
    intent: str
    jurisdiction: str
    key_dates: list[str]

class ResearchOutput(BaseModel):
    legislation: list[dict]  # [{"ref": "ERA_1996_s95", "text": "..."}]
    tribunals: list[dict]    # [{"case": "Smith_v_Jones", "holding": "..."}]
    guidance: list[dict]     # [{"source": "ACAS_Code", "text": "..."}]
    confidence: float

def researcher_agent(input: ResearchInput) -> ResearchOutput:
    """
    Phase 2A (Vector Search): Semantic search of legal text
    Phase 2B (Graph Traversal): Relationship exploration of precedents
    
    Returns unified context bundle.
    """
    
    # ========== PHASE 2A: VECTOR SEARCH (Milvus) ==========
    connections.connect("default", host="milvus.default.svc", port=19530)
    collection = Collection("legal_knowledge_v1")
    
    # Convert intent to embedding
    from sentence_transformers import SentenceTransformer
    encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    query_embedding = encoder.encode(input.intent).tolist()
    
    # Search Milvus
    results = collection.search(
        data=[query_embedding],
        anns_field="embedding",
        param={"metric_type": "IP", "params": {"ef": 256}},
        limit=10,
        output_fields=["source_ref", "text_payload", "source_type"]
    )
    
    milvus_chunks = []
    for hit in results[0]:
        milvus_chunks.append({
            "ref": hit.source_ref,
            "text": hit.text_payload,
            "type": hit.source_type
        })
    
    # ========== PHASE 2B: GRAPH TRAVERSAL (Neo4j) ==========
    driver = neo4j.GraphDatabase.driver(
        "bolt://neo4j.default.svc:7687",
        auth=("neo4j", "password")
    )
    
    legislation = []
    tribunals = []
    
    with driver.session() as session:
        # Query: Get legislation + citing tribunals
        query = """
        MATCH (c:TextChunk)-[:BELONGS_TO]->(s:Section)-[:PART_OF]->(a:Legislation)
        WHERE c.id IN $chunk_ids
        OPTIONAL MATCH (t:TribunalCase)-[:CITES]->(s)
        OPTIONAL MATCH (override:TribunalCase)-[:OVERRIDES]->(t)
        RETURN 
            a.act_id, a.title,
            s.section_id, s.number, s.text,
            t.case_ref, t.date, t.holding,
            override.case_ref as override_ref
        ORDER BY t.date DESC
        """
        
        chunk_ids = [c["ref"] for c in milvus_chunks]
        results = session.run(query, chunk_ids=chunk_ids)
        
        for record in results:
            legislation.append({
                "ref": f"{record['a.act_id']}_s{record['s.section_id']}",
                "title": record['a.title'],
                "text": record['s.text']
            })
            
            if record['t.case_ref']:
                tribunals.append({
                    "case": record['t.case_ref'],
                    "date": record['t.date'],
                    "holding": record['t.holding'],
                    "overridden_by": record['override_ref']
                })
    
    driver.close()
    
    return ResearchOutput(
        legislation=legislation,
        tribunals=tribunals,
        guidance=[],  # Would populate from separate guidance DB
        confidence=0.92
    )
```

### 2.3 Drafting Agent

```python
# Location: apps/legal-orchestrator/src/agents/drafting_agent.py

from langchain_anthropic import ChatAnthropic
import json

class DraftingInput(BaseModel):
    intent: str
    jurisdiction: str
    anonymized_text: str
    context: ResearchOutput

class DraftOutput(BaseModel):
    text: str  # Includes [REF: ...] citations
    citations: list[str]
    confidence_score: float

def drafting_agent(input: DraftingInput) -> DraftOutput:
    """
    Phase 3: Generate legal advice constrained to retrieved context.
    
    KEY CONSTRAINT: Only use information from input.context
    DO NOT hallucinate citations or facts.
    """
    
    llm = ChatAnthropic(model="claude-opus", temperature=0.7)
    
    # Construct context string
    context_str = "LEGISLATION:\n"
    for leg in input.context.legislation:
        context_str += f"  [{leg['ref']}]: {leg['text']}\n"
    
    context_str += "\nTRIBUNAL PRECEDENTS:\n"
    for tribunal in input.context.tribunals:
        context_str += f"  [{tribunal['case']}] ({tribunal['date']}): {tribunal['holding']}\n"
    
    prompt = f"""
    You are a legal advisor. Based STRICTLY on the provided context, 
    generate legal advice for this anonymized grievance:
    
    GRIEVANCE: {input.anonymized_text}
    JURISDICTION: {input.jurisdiction}
    INTENT: {input.intent}
    
    CONTEXT (You may ONLY reference information here):
    {context_str}
    
    RULES:
    1. Only use facts from the provided context
    2. For every statutory reference, include [REF: statute_id]
    3. For every case reference, include [REF: case_name_year]
    4. Do NOT invent citations
    5. Do NOT reference external knowledge
    6. Be precise and cite everything
    
    Generate the legal advice now:
    """
    
    response = llm.invoke(prompt)
    advice_text = response.content
    
    # Extract citations from generated text (will be validated by Gatekeeper)
    import re
    citations = re.findall(r'\[REF: ([^\]]+)\]', advice_text)
    
    return DraftOutput(
        text=advice_text,
        citations=citations,
        confidence_score=0.85
    )
```

### 2.4 Forensic Gatekeeper (Rust - Deterministic Validation)

```rust
// Location: apps/legal-orchestrator/src/forensic/gatekeeper.rs

use std::collections::HashSet;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ForensicInput {
    pub draft_text: String,
    pub citations: Vec<String>,
    pub context_references: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ForensicOutput {
    pub is_valid: bool,
    pub error_message: Option<String>,
    pub validation_detail: String,
}

/// Gatekeeper: Deterministic, non-ML validation of citations
pub fn validate_draft(input: ForensicInput) -> ForensicOutput {
    // Step 1: Extract all [REF: ...] citations from draft
    let draft_citations = extract_citations(&input.draft_text);
    
    // Step 2: Build set of valid references from context
    let context_set: HashSet<&str> = input.context_references.iter()
        .map(|s| s.as_str())
        .collect();
    
    // Step 3: Verify each draft citation exists in context
    for citation in &draft_citations {
        if !context_set.contains(citation.as_str()) {
            return ForensicOutput {
                is_valid: false,
                error_message: Some(
                    format!("Fabricated citation: [{}] not in context", citation)
                ),
                validation_detail: format!(
                    "LLM referenced [{}] but it was not in retrieved context. \
                     This is a hallucination. Rejecting draft.",
                    citation
                ),
            };
        }
    }
    
    // Step 4: (Optional) Semantic drift check
    // Verify that the context meaning hasn't been twisted
    // This could use cosine similarity between draft sentence and source chunk
    
    ForensicOutput {
        is_valid: true,
        error_message: None,
        validation_detail: format!(
            "All {} citations verified in context. Draft is valid.",
            draft_citations.len()
        ),
    }
}

fn extract_citations(text: &str) -> Vec<String> {
    use regex::Regex;
    let re = Regex::new(r"\[REF: ([^\]]+)\]").unwrap();
    re.captures_iter(text)
        .map(|cap| cap[1].to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_valid_citations() {
        let input = ForensicInput {
            draft_text: "Based on [REF: ERA_1996_s95], dismissal is unfair.".to_string(),
            citations: vec!["ERA_1996_s95".to_string()],
            context_references: vec!["ERA_1996_s95".to_string(), "ACAS_Code_4".to_string()],
        };
        
        let result = validate_draft(input);
        assert!(result.is_valid);
    }
    
    #[test]
    fn test_fabricated_citation() {
        let input = ForensicInput {
            draft_text: "The court said [REF: FAKE_2099_s1000] applies...".to_string(),
            citations: vec!["FAKE_2099_s1000".to_string()],
            context_references: vec!["ERA_1996_s95".to_string()],
        };
        
        let result = validate_draft(input);
        assert!(!result.is_valid);
        assert!(result.error_message.unwrap().contains("Fabricated"));
    }
}
```

---

## PART 3: COMPLETE 9-STEP EXECUTION WALKTHROUGH

### Step 1: User Submits Grievance (Zone 1)

```
Input (User submits):
"I, John Smith, worked at Acme Corp earning £50,000. On March 15, 2024, 
I was fired without warning. This is unfair."
```

### Step 2: Anonymization (Zone 1 - Anonymizer Service)

```
PII Stripper detects:
- NAME: "John Smith" → [EMPLOYEE_1]
- COMPANY: "Acme Corp" → [COMPANY_A]
- SALARY: "£50,000" → [AMOUNT_1]
- DATE: "March 15, 2024" → [DATE_1]

Output (Anonymized):
"I, [EMPLOYEE_1], worked at [COMPANY_A] earning [AMOUNT_1]. 
On [DATE_1], I was fired without warning. This is unfair."

Storage (Zone 1 PostgreSQL):
{
  EMPLOYEE_1: "John Smith",
  COMPANY_A: "Acme Corp",
  AMOUNT_1: "£50,000",
  DATE_1: "2024-03-15"
}
```

### Step 3: Transmission to Zone 2 (mTLS Tunnel)

```json
Payload across tunnel:
{
  "case_id": "c_xyz789",
  "anonymized_text": "I, [EMPLOYEE_1], worked at [COMPANY_A]...",
  "jurisdiction": "UK",
  "legal_domain": "EMPLOYMENT"
}

Note: Token mappings do NOT cross the tunnel.
Zone 2 never knows these are real people/amounts.
```

### Step 4: Temporal Workflow Starts (Zone 2)

```
Temporal creates CaseWorkflow:
- State: INTAKE_PENDING
- Immutable ledger initialized
- Publishes to agent.intake.request
```

### Step 5: Intake Agent Processes (Zone 2)

```
Input:
"I, [EMPLOYEE_1], worked at [COMPANY_A] earning [AMOUNT_1]. 
On [DATE_1], I was fired without warning. This is unfair."

LLM Analysis (Claude):
"The user is describing dismissal without notice."

Output:
{
  "intent": "Unfair Dismissal",
  "jurisdiction": "UK_EMPLOYMENT",
  "user_persona": "EMPLOYEE",
  "key_dates": ["[DATE_1]"],
  "confidence": 0.98
}

Temporal: State → RESEARCH_PENDING
```

### Step 6: Researcher Agent Queries Databases (Zone 2)

```
Phase A: Milvus Vector Search
- Query embedding: "unfair dismissal without notice"
- Search: legal_knowledge_v1
- Results: [
    {chunk_id: 884, ref: "ERA_1996_s95", text: "Dismissal..."},
    {chunk_id: 892, ref: "ACAS_Code_4", text: "Procedural..."},
    {chunk_id: 901, ref: "ERA_1996_s94", text: "Notice..."}
  ]

Phase B: Neo4j Graph Traversal
- Query: "Find legislation and tribunals citing these chunks"
- Results: [
    {Act: "Employment Rights Act 1996", Section: 95, Cases: [...]},
    {Tribunal: "Smith_v_Jones_2024", Date: "2024-01-15", Holding: "Dismissal unfair"},
    {Tribunal: "Brown_v_Co_2023", Date: "2023-09-20", Holding: "Notice required"}
  ]

Output:
{
  "legislation": [
    {ref: "ERA_1996_s95", text: "No dismissal without procedure"},
    {ref: "ACAS_Code_4", text: "Follow disciplinary process"}
  ],
  "tribunals": [
    {case: "Smith_v_Jones_2024", holding: "Dismissal unfair if no notice"}
  ]
}

Temporal: State → DRAFTING_PENDING
```

### Step 7: Drafting Agent Generates (Zone 2)

```
Drafting LLM receives:
- Intent: "Unfair Dismissal"
- Anonymous text: "I, [EMPLOYEE_1], worked at [COMPANY_A]..."
- Context: ERA_1996_s95, Smith_v_Jones_2024, etc.

LLM Constraints:
- ONLY use context provided
- Include [REF: ...] for every statute/case cited
- NO external knowledge

Generated Draft:
"Based on [REF: ERA_1996_s95], an employer must follow proper 
dismissal procedures. The case [REF: Smith_v_Jones_2024] (2024) 
established that dismissal without procedural fairness is unfair. 
[EMPLOYEE_1]'s dismissal on [DATE_1] without notice appears to violate 
these protections. [EMPLOYEE_1] may have grounds for unfair dismissal claim."

Extracted citations: ["ERA_1996_s95", "Smith_v_Jones_2024"]

Temporal: State → FORENSIC_PENDING
```

### Step 8: Forensic Gatekeeper Validates (Zone 2) ⭐

```
Input:
Draft citations: ["ERA_1996_s95", "Smith_v_Jones_2024"]
Context references: [
  "ERA_1996_s95",
  "ACAS_Code_4",
  "Smith_v_Jones_2024",
  "Brown_v_Co_2023"
]

Gatekeeper Algorithm (Rust):

1. Extract citations from draft:
   ✓ "ERA_1996_s95" ← FOUND in context
   ✓ "Smith_v_Jones_2024" ← FOUND in context

2. Verify all exist:
   ERA_1996_s95: ✓ YES
   Smith_v_Jones_2024: ✓ YES

3. Result: IS_VALID = TRUE

Output:
{
  "is_valid": true,
  "error_message": null,
  "validation_detail": "All 2 citations verified. Draft approved."
}

Temporal: State → COMPLETION_PENDING
```

### Step 9: Re-Hydration & Delivery (Zone 1)

```
Zone 2 sends back (via mTLS):
{
  "case_id": "c_xyz789",
  "anonymized_advice": "Based on [REF: ERA_1996_s95], an employer must 
                        follow proper dismissal procedures. The case 
                        [REF: Smith_v_Jones_2024] (2024) established that 
                        dismissal without procedural fairness is unfair. 
                        [EMPLOYEE_1]'s dismissal on [DATE_1] without notice 
                        appears to violate these protections."
}

Zone 1 (Local API Gateway):
1. Receives response
2. Queries PostgreSQL for token mappings:
   [EMPLOYEE_1] → "John Smith"
   [DATE_1] → "2024-03-15"
3. Re-hydrates:

FINAL ADVICE (shown to user):
"Based on the Employment Rights Act 1996 Section 95, an employer must 
follow proper dismissal procedures. The case Smith v Jones (2024) 
established that dismissal without procedural fairness is unfair. 
John Smith's dismissal on March 15, 2024 without notice appears to 
violate these protections. John Smith may have grounds for an unfair 
dismissal claim."

User sees: REAL names, REAL dates, REAL company names
Zone 2 saw: ONLY [TOKENS], [TOKENS], [TOKENS]
```

---

## PART 4: ERROR HANDLING & RETRY LOGIC

### Hallucination Detected (Retry Loop)

```
If Gatekeeper finds fabricated citation:

Attempt 1:
  Drafting → "Based on [REF: FAKE_LAW_2099_s1]..." → Gatekeeper → FAIL

Signal to Drafting Agent:
  "HALLUCINATION_DETECTED: [FAKE_LAW_2099_s1] not in context
   Rewrite without fabricated citations. Apply temperature penalty."

Attempt 2:
  Drafting (temperature: 0.3, stricter prompting) → "Based on 
  [REF: ERA_1996_s95]..." → Gatekeeper → PASS ✓

Result: Valid draft approved
```

### Network Failure (Retry Policy)

```
If Zone 2 service crashes during Drafting:

Temporal remembers:
  - Case ID: c_xyz789
  - Last complete state: RESEARCH_COMPLETE
  - Workflow state saved to PostgreSQL

Auto-retry after 2 seconds:
  Resumes at DRAFTING_PENDING (not from start)
  Max 3 attempts, then fail

Result: No data loss, resumable workflow
```

---

## PART 5: TESTING THE ALGORITHM

### Unit Tests (Gatekeeper)

```python
# tests/test_forensic_gatekeeper.py

def test_valid_citations():
    """Test that valid citations pass"""
    draft = "Based on [REF: ERA_1996_s95], dismissal is unfair."
    context = ["ERA_1996_s95", "ACAS_Code"]
    
    result = validate_draft(draft, context)
    assert result.is_valid == True

def test_fabricated_citation():
    """Test that fabricated citations are rejected"""
    draft = "The law [REF: FAKE_2099_s1] says..."
    context = ["ERA_1996_s95", "ACAS_Code"]
    
    result = validate_draft(draft, context)
    assert result.is_valid == False
    assert "FAKE_2099" in result.error_message

def test_missing_citations():
    """Test that uncited facts are flagged"""
    draft = "The employer was wrong. [REF: ERA_1996_s95] applies."
    context = ["ERA_1996_s95"]
    
    # This test would check semantic drift: is "employer was wrong"
    # actually supported by the ERA citation?
    pass

def test_citation_manipulation():
    """Test that citation meaning can't be twisted"""
    draft = "[REF: ERA_1996_s95] says dismissal is ALWAYS fair."
    context_actual = "ERA_1996_s95: Dismissal is UNFAIR if procedures not followed"
    
    # Semantic check: does draft meaning match source meaning?
    result = semantic_drift_check(draft, context_actual)
    assert result.is_valid == False
```

### Integration Tests (Temporal Workflow)

```python
# tests/test_workflow_e2e.py

def test_complete_workflow():
    """Test the complete 9-step flow"""
    
    # Setup
    case_input = CasePayload(
        case_id="test_123",
        anonymized_text="I, [EMP_1], was fired on [DATE_1]",
        jurisdiction="UK",
        legal_domain="EMPLOYMENT"
    )
    
    # Execute workflow
    result = temporal_client.execute_workflow(
        "LegalAnalysisWorkflow",
        case_input,
        id="test_workflow_123"
    )
    
    # Verify
    assert result.anonymized_advice is not None
    assert len(result.citations) > 0
    assert result.confidence_score > 0.8
    assert "[EMP_1]" in result.anonymized_advice  # Tokens preserved
    assert "John Smith" not in result.anonymized_advice  # Real name NOT leaked

def test_hallucination_recovery():
    """Test that the system recovers from drafting hallucinations"""
    
    # Mock Drafting Agent to return fabricated citation on attempt 1
    mock_drafting_first_attempt = "Based on [REF: FAKE_LAW], ..."
    mock_drafting_second_attempt = "Based on [REF: ERA_1996_s95], ..."
    
    # Execute workflow
    result = temporal_client.execute_workflow(...)
    
    # Verify it recovered on second attempt
    assert result.is_valid == True
    assert "FAKE_LAW" not in result.anonymized_advice
```

---

## PART 6: PERFORMANCE TARGETS

| Metric | Target | Notes |
|--------|--------|-------|
| Intake latency | <500ms | Pure NLP, no DB |
| Research latency | <2s | Milvus + Neo4j queries |
| Drafting latency | <5s | LLM inference |
| Forensic validation | <50ms | Deterministic Rust |
| Complete workflow (p95) | <10s | All steps combined |
| Hallucination rate | <2% | Post-Gatekeeper validation |
| Citation accuracy | >98% | All cited refs verified |

---

## CRITICAL INVARIANTS (Must Never Violate)

1. **Forensic Gatekeeper Cannot Be Bypassed:** Every draft must pass citation validation
2. **Zone 2 Never Sees PII:** Only tokenized data reaches Talos cluster
3. **Deterministic Validation:** Gatekeeper logic is pure math, not AI
4. **Immutable Audit Trail:** Every workflow state is logged (Temporal)
5. **No Hallucination Recovery Without Gatekeeper:** If Gatekeeper rejects, must redraft
6. **Token Integrity:** Tokens cannot be mapped by Zone 2, only Zone 1

---

**This algorithm is the CORE of IterLaw. Every sprint must respect these constraints.**
