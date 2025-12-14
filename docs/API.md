# API Documentation

## Base URL
- **Development**: `http://localhost:8000/api`

## Endpoints

### 1. Health Check
```
GET /health
```
Check if the API is running.

**Response**:
```json
{
  "status": "healthy"
}
```

---

### 2. Validate BRD (Step 1)
```
POST /api/validate-brd
```
Upload BRD and run quality validation **without** starting generation.

**Request** (multipart/form-data):
- `file`: BRD file (.docx or .txt, max 15MB)
- `payload`: JSON string containing:
  ```json
  {
    "instructions": "Optional custom instructions",
    "artefacts": {
      "epics_and_stories": true,
      "data_model": true,
      "functional_tests": true,
      "gherkin_tests": true,
      "code_skeleton": true
    }
  }
  ```

**Response**:
```json
{
  "job_id": "unique-job-id",
  "validation_report": {
    "ctq_scores": {
      "completeness": 4,
      "clarity": 3,
      "accuracy": 5,
      "testability": 2,
      "traceability": 3,
      "feasibility": 4,
      "consistency": 5,
      "prioritisation": 3,
      "nfr_coverage": 2,
      "stakeholder_validation": 4
    },
    "overall_score": 3.5,
    "key_gaps": ["Gap description..."],
    "remediation_actions": ["Action..."],
    "detailed_findings": { /* CTQ dimension details */ }
  },
  "gap_fixes": [
    {
      "gap_id": "gap_1",
      "gap_description": "Missing exception flows",
      "affected_section": "Section 3.2",
      "current_text": "Original text",
      "suggested_fix": "AI-generated fix",
      "rationale": "Why this fix is needed",
      "confidence": "high",
      "user_action": "pending"
    }
  ]
}
```

---

### 3. Update Gap Fix (Human Review)
```
POST /api/update-gap-fix/{job_id}
```
User accepts, edits, or rejects an AI-suggested fix.

**Request** (form-data):
- `gap_id`: Gap identifier (e.g., "gap_1")
- `action`: One of: `"accepted"`, `"edited"`, `"rejected"`
- `final_text`: (Optional) Edited text if action is "edited"

**Response**:
```json
{
  "gap_id": "gap_1",
  "action": "accepted",
  "updated": true
}
```

---

### 4. Proceed to Stage (Staged Pipeline)
```
POST /api/proceed-to-stage/{job_id}
```
Progress to the next pipeline stage after user approval.

**Request** (form-data):
- `next_stage`: One of: `"EPICS"`, `"FUNCTIONAL_TESTS"`, `"GHERKIN_TESTS"`, `"DATA_MODEL"`, `"CODE_GENERATION"`

**Response**:
```json
{
  "job_id": "unique-job-id",
  "stage": "EPICS",
  "status": "started" | "already_completed"
}
```

**Note**: If stage was already completed, status is `"already_completed"` and no regeneration occurs.

---

### 5. Generate More Artifacts
```
POST /api/generate-more/{job_id}
```
Generate additional artifacts at the current stage based on user instructions.

**Request** (JSON):
```json
{
  "stage": "EPICS" | "FUNCTIONAL_TESTS" | "GHERKIN_TESTS",
  "instructions": "Generate additional test scenarios for checkout flow",
  "context_ids": ["story_1", "story_2"]  // Optional: filter to specific stories
}
```

**Response**:
```json
{
  "job_id": "unique-job-id",
  "stage": "FUNCTIONAL_TESTS",
  "status": "generating"
}
```

**Supported Stages**:
- `EPICS`: Generate more epics and user stories
- `FUNCTIONAL_TESTS`: Generate more functional tests (optionally filtered by story IDs)
- `GHERKIN_TESTS`: Generate more Gherkin scenarios (optionally filtered by story IDs)

---

### 6. Get Job Status
```
GET /api/status/{job_id}
```
Poll for generation progress and results.

**Response**:
```json
{
  "status": "in_progress" | "completed" | "failed",
  "error": null,
  "steps": [
    {
      "name": "Generating EPICs & User Stories",
      "status": "in_progress" | "completed" | "failed",
      "error": null
    }
  ],
  "results": {
    "project_name": "Generated Project Name",
    "validation_report": { /* Validation results */ },
    "gap_fixes": [ /* Gap fix array */ ],
    "epics": [ /* Epic objects */ ],
    "user_stories": [ /* Story objects */ ],
    "entities": [ /* Entity objects */ ],
    "mermaid": "erDiagram...",
    "functional_tests": [ /* Test objects */ ],
    "gherkin_tests": [ /* Gherkin scenario objects */ ],
    "code_skeleton": { /* Code structure */ }
  },
  "artefacts": {
    "epics_and_stories": true,
    "data_model": true,
    "functional_tests": true,
    "gherkin_tests": true,
    "code_skeleton": true
  }
}
```

---

### 7. Download Results
```
GET /api/download/{job_id}
```
Download all generated artifacts as a ZIP file.

**Response**: ZIP file containing:
- `epics_and_stories.json`
- `functional_tests.json`
- `gherkin_tests.feature`
- `entities.json`
- `diagram.mmd`
- `code_skeleton/` (folder with generated code)

---

### 8. Update Epic
```
PUT /api/epics/{epic_id}
```
Update an epic's properties.

**Request** (JSON):
```json
{
  "job_id": "unique-job-id",
  "name": "Updated Epic Name",
  "description": "Updated description"
}
```

**Response**:
```json
{
  "epic_id": "epic_1",
  "updated": true
}
```

---

### 9. Delete Epic (Cascade)
```
DELETE /api/epics/{epic_id}?job_id={job_id}
```
Delete an epic and all associated user stories and tests.

**Response**:
```json
{
  "epic_id": "epic_1",
  "deleted": true,
  "cascade_deleted": {
    "user_stories": 5,
    "functional_tests": 12,
    "gherkin_tests": 8
  }
}
```

---

### 10. Update User Story
```
PUT /api/stories/{story_id}
```
Update a user story's properties.

**Request** (JSON):
```json
{
  "job_id": "unique-job-id",
  "title": "Updated title",
  "role": "Updated role",
  "goal": "Updated goal",
  "benefit": "Updated benefit"
}
```

---

### 11. Delete User Story (Cascade)
```
DELETE /api/stories/{story_id}?job_id={job_id}
```
Delete a user story and all associated tests.

**Response**:
```json
{
  "story_id": "story_1",
  "deleted": true,
  "cascade_deleted": {
    "functional_tests": 3,
    "gherkin_tests": 2
  }
}
```

---

### 12. Update Functional Test
```
PUT /api/tests/{test_id}
```
Update a functional test's properties.

**Request** (JSON):
```json
{
  "job_id": "unique-job-id",
  "title": "Updated test title",
  "objective": "Updated objective",
  "preconditions": ["Updated precondition"],
  "test_steps": ["Step 1", "Step 2"],
  "expected_results": ["Result 1", "Result 2"]
}
```

---

### 13. Delete Functional Test
```
DELETE /api/tests/{test_id}?job_id={job_id}
```

---

### 14. Update Gherkin Scenario
```
PUT /api/gherkin/{scenario_id}
```
Update a Gherkin scenario's properties.

**Request** (JSON):
```json
{
  "job_id": "unique-job-id",
  "feature_name": "Updated feature",
  "scenario_name": "Updated scenario",
  "given": ["Given step 1"],
  "when": ["When step 1"],
  "then": ["Then step 1"]
}
```

---

### 15. Delete Gherkin Scenario
```
DELETE /api/gherkin/{scenario_id}?job_id={job_id}
```

---

## Data Models

### Epic
```typescript
{
  id: string;
  name: string;
  description: string;
}
```

### User Story
```typescript
{
  id: string;
  epic_id: string;
  title: string;
  role: string;
  goal: string;
  benefit: string;
  acceptance_criteria: AcceptanceCriterion[];
  source_chunks: string[];
}
```

### Functional Test
```typescript
{
  id: string;
  story_id: string;
  title: string;
  objective: string;
  preconditions: string[];
  test_steps: string[];
  expected_results: string[];
  source_chunks: string[];
}
```

### Gherkin Scenario
```typescript
{
  id: string;
  story_id: string;
  feature_name: string;
  scenario_name: string;
  given: string[];
  when: string[];
  then: string[];
  source_chunks: string[];
}
```

### Entity
```typescript
{
  name: string;
  description: string;
  fields: EntityField[];
}
```

---

## Error Responses

All endpoints may return these error responses:

**400 Bad Request**:
```json
{
  "detail": "Invalid payload format"
}
```

**404 Not Found**:
```json
{
  "detail": "Job not found"
}
```

**500 Internal Server Error**:
```json
{
  "detail": "Error message"
}
```

---

## Workflow

### Staged Pipeline Workflow (Current Implementation)

**Stage 1: Validation**
```
POST /api/validate-brd
→ Upload BRD, receive validation report and gap fixes

POST /api/update-gap-fix/{job_id} (for each gap)
→ Accept, edit, or reject AI suggestions
```

**Stage 2: EPICs & User Stories**
```
POST /api/proceed-to-stage/{job_id} with next_stage="EPICS"
→ Generate epics and user stories

GET /api/status/{job_id}
→ Poll until stage completes

PUT /api/epics/{epic_id}, DELETE /api/epics/{epic_id}
→ Edit or delete generated epics

PUT /api/stories/{story_id}, DELETE /api/stories/{story_id}
→ Edit or delete generated stories

POST /api/generate-more/{job_id} with stage="EPICS"
→ Generate additional epics/stories (optional)
```

**Stage 3: Functional Tests**
```
POST /api/proceed-to-stage/{job_id} with next_stage="FUNCTIONAL_TESTS"
→ Generate functional tests from stories

GET /api/status/{job_id}
→ Poll until stage completes

PUT /api/tests/{test_id}, DELETE /api/tests/{test_id}
→ Edit or delete tests

POST /api/generate-more/{job_id} with stage="FUNCTIONAL_TESTS"
→ Generate more tests (with optional context_ids filtering)
```

**Stage 4: Gherkin Tests**
```
POST /api/proceed-to-stage/{job_id} with next_stage="GHERKIN_TESTS"
→ Generate Gherkin BDD scenarios

GET /api/status/{job_id}
→ Poll until stage completes

PUT /api/gherkin/{scenario_id}, DELETE /api/gherkin/{scenario_id}
→ Edit or delete scenarios

POST /api/generate-more/{job_id} with stage="GHERKIN_TESTS"
→ Generate more scenarios (with optional context_ids filtering)
```

**Stage 5: Data Model**
```
POST /api/proceed-to-stage/{job_id} with next_stage="DATA_MODEL"
→ Generate entity-relationship model and Mermaid diagram

GET /api/status/{job_id}
→ Poll until stage completes
```

**Stage 6: Code Generation**
```
POST /api/proceed-to-stage/{job_id} with next_stage="CODE_GENERATION"
→ Generate Java Selenium + Cucumber test automation framework

GET /api/status/{job_id}
→ Poll until stage completes
```

**Stage 7: Download**
```
GET /api/download/{job_id}
→ Download all artifacts as ZIP file
```

### Stage Progression Rules

- User must explicitly proceed to each stage (no auto-advancement)
- Previously completed stages are skipped if revisited (status: "already_completed")
- Stage history tracks completion timestamps
- Edit/delete operations available at EPICS, FUNCTIONAL_TESTS, GHERKIN_TESTS stages
- Generate-more operations available at EPICS, FUNCTIONAL_TESTS, GHERKIN_TESTS stages

---

## Rate Limiting

AWS Bedrock API calls use exponential backoff retry logic:
- Base delay: 2 seconds
- Max retries: 5
- Backoff sequence: 2s, 4s, 8s, 16s, 32s

---

## CORS Configuration

Allowed origins in development:
- `http://localhost:5173`
- `http://localhost:5174`
