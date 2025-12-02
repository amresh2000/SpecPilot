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

### 4. Proceed to Generation (Step 2)
```
POST /api/proceed-to-generation/{job_id}
```
After reviewing gap fixes, start the actual generation pipeline.

**Response**:
```json
{
  "job_id": "unique-job-id",
  "status": "generation_started"
}
```

---

### 5. Get Job Status
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

### 6. Download Results
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

### 7. Generate More Tests for Story
```
POST /api/stories/{story_id}/more-tests
```
Generate additional functional tests for a specific user story.

**Request** (form-data):
- `job_id`: Job identifier
- `instructions`: Optional custom instructions for test generation

**Response**:
```json
{
  "story_id": "story_1",
  "new_tests_count": 3,
  "new_tests": [ /* Array of new functional test objects */ ]
}
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

### Two-Step Workflow (Recommended)

1. **Validate BRD**:
   ```
   POST /api/validate-brd
   → Receive validation report and gap fixes
   ```

2. **Review Gap Fixes** (Human-in-the-Loop):
   ```
   POST /api/update-gap-fix/{job_id} (for each gap)
   → Accept, edit, or reject AI suggestions
   ```

3. **Proceed to Generation**:
   ```
   POST /api/proceed-to-generation/{job_id}
   → Start artifact generation
   ```

4. **Poll for Status**:
   ```
   GET /api/status/{job_id}
   → Monitor progress
   ```

5. **Download Results**:
   ```
   GET /api/download/{job_id}
   → Get ZIP file with all artifacts
   ```

### Legacy Single-Step Workflow

For backward compatibility, you can still use:
```
POST /api/generate
→ Directly start generation without validation review
```

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
