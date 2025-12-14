# Architecture Documentation

## System Overview

SpecPilot is a two-tier web application with a staged pipeline architecture that transforms Business Requirements Documents (BRDs) into technical artifacts using AWS Bedrock (Claude 3.5 Sonnet v2). The system follows a user-approved progression through 7 stages, from quality validation to final code generation.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  - BRD Upload Interface                                      │
│  - Validation Review UI (Human-in-the-Loop)                  │
│  - Results Visualization                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/REST
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              API Layer (routes/)                      │  │
│  │  - /validate-brd (Stage 1)                            │  │
│  │  - /update-gap-fix (Gap fix review)                   │  │
│  │  - /proceed-to-stage/{job_id} (Stages 2-7)            │  │
│  │  - /generate-more (Additional artifacts)              │  │
│  │  - CRUD endpoints (edit/delete artifacts)             │  │
│  │  - /status, /download                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                        │                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Service Layer (services/)                   │  │
│  │  - BRDParser: Document parsing (.docx/.txt)          │  │
│  │  - GenerationPipeline: Orchestration                  │  │
│  │  - BedrockLLMClient: AWS Bedrock integration          │  │
│  │  - JobManager: In-memory state management             │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ Boto3 SDK
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   AWS Bedrock (Claude 3.5 Sonnet v2)         │
│  - BRD Quality Validation (10 CTQ dimensions)                │
│  - Gap Fix Generation                                        │
│  - Artifact Generation (Epics, Stories, Tests, Code)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend (`frontend/`)

**Technology Stack**:
- React 18.3+ with TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Lucide React (icons)
- React Router (navigation)

**Key Components** (8-stage workflow):
- `ConfigurationPage.tsx`: BRD upload and instructions (Stage 1)
- `ValidationPage.tsx`: Quality validation review with gap fixes (Stage 2)
- `EpicsRefinementPage.tsx`: EPICs & User Stories editing (Stage 3)
- `FunctionalTestsRefinementPage.tsx`: Functional test case editing (Stage 4)
- `GherkinTestsRefinementPage.tsx`: Gherkin BDD scenario editing (Stage 5)
- `DataModelPage.tsx`: Entity-relationship model visualization (Stage 6)
- `CodeSkeletonPage.tsx`: Java Selenium + Cucumber code preview (Stage 7)
- `SummaryPage.tsx`: Final download and completion (Stage 8)

**State Management**:
- Local component state with React hooks
- React Router for staged workflow navigation
- URL parameters for job_id and stage tracking
- Toast notifications for user feedback and error handling

---

### Backend (`backend/`)

**Technology Stack**:
- FastAPI 0.115+ (async web framework)
- Python 3.8+
- AWS Boto3 (Bedrock SDK)
- python-docx (Word document parsing)
- Pydantic v2 (data validation)

**Directory Structure**:
```
backend/
├── app/
│   ├── main.py                    # FastAPI application entry
│   ├── models.py                  # Pydantic data models
│   ├── routes/
│   │   ├── validation_endpoints.py    # Validation API
│   │   ├── staged_endpoints.py        # Staged pipeline API
│   │   └── crud_endpoints.py          # Edit/delete operations
│   ├── services/
│   │   ├── brd_parser.py              # Document parsing logic
│   │   ├── generation_pipeline.py     # Stage orchestration
│   │   ├── llm_client.py              # AWS Bedrock integration
│   │   └── job_manager.py             # In-memory job state
│   └── utils.py                   # Logging and utility functions
├── generated/                     # Output directory for artifacts
└── venv/                          # Python virtual environment
```

---

## Core Services

### 1. BRDParser (`brd_parser.py`)

Parses BRD documents into structured chunks for LLM processing.

**Capabilities**:
- `.docx` parsing with python-docx
- `.txt` file parsing
- Section extraction
- Table detection and parsing
- Chunk generation with metadata

**Output Schema**:
```python
{
    "filename": str,
    "file_type": str,
    "num_pages": int,
    "sections": [
        {
            "id": str,
            "title": str,
            "text": str,
            "level": int
        }
    ],
    "tables": [
        {
            "table_id": str,
            "headers": List[str],
            "rows": List[List[str]]
        }
    ],
    "chunks": [
        {
            "id": str,
            "type": str,  # "text", "table", "list"
            "text": str,
            "metadata": dict
        }
    ]
}
```

---

### 2. BedrockLLMClient (`llm_client.py`)

Handles all AWS Bedrock API interactions with Claude 3.5 Sonnet v2.

**Model Configuration**:
- Model ID: `us.anthropic.claude-3-5-sonnet-20241022-v2:0`
- Max tokens: 4096
- Temperature: 0.7
- Region: us-east-1

**Retry Logic**:
- Exponential backoff for throttling (2s → 4s → 8s → 16s → 32s)
- Max retries: 5
- Handles `ThrottlingException` and JSON parse errors

**LLM Calls**:
1. `validate_brd_quality()`: 10 CTQ dimension validation
2. `generate_gap_fixes()`: AI-suggested remediation for gaps
3. `generate_epics_and_stories()`: Epic and user story generation with acceptance criteria
4. `generate_functional_tests()`: Functional test case generation from stories
5. `generate_gherkin_tests()`: BDD Gherkin scenarios from functional tests
6. `generate_data_model()`: Entity-relationship model + Mermaid diagram
7. `generate_code_skeleton()`: Java Selenium + Cucumber test automation framework

---

### 3. GenerationPipeline (`generation_pipeline.py`)

Stage-by-stage generation orchestrator called by staged_endpoints.py.

**Pipeline Methods** (called per stage):
1. `_parse_brd()`: Parse BRD document into structured chunks
2. `_generate_epics_and_stories()`: Generate project name, epics, and user stories
3. `_generate_functional_tests()`: Generate functional test cases from stories
4. `_generate_gherkin_tests()`: Generate Gherkin BDD scenarios from functional tests
5. `_generate_data_model()`: Generate entities and Mermaid ER diagram
6. `_generate_code_skeleton()`: Generate Java Selenium + Cucumber framework with POM

**Stage History Tracking**:
- Maintains stage history with completion timestamps
- Skips regeneration if stage already completed
- Supports progressive advancement through pipeline
- Updates job status and step tracking

---

### 4. JobManager (`job_manager.py`)

In-memory state manager for generation jobs.

**Data Structure**:
```python
class Job:
    job_id: str
    status: JobStatus  # "pending", "in_progress", "completed", "failed"
    current_stage: PipelineStage  # Tracks current stage
    stage_history: List[StageHistoryEntry]  # Stage completion timestamps
    instructions: str
    uploaded_filename: str
    brd_data: dict  # Parsed BRD with chunks
    steps: List[Step]  # Step-by-step progress tracking
    results: GenerationResults  # All generated artifacts
    error: Optional[str]

class StageHistoryEntry:
    stage: PipelineStage
    status: str  # "completed", "in_progress"
    completed_at: Optional[datetime]
```

**Limitations**:
- In-memory only (lost on server restart)
- No persistence layer
- Not suitable for production at scale

---

## Data Flow

### Staged Pipeline Workflow (7 Stages with Human-in-the-Loop)

```
Stage 1: BRD Upload and Validation
1. User uploads BRD (ConfigurationPage)
   ↓
2. POST /api/validate-brd
   ↓
3. BRDParser.parse() → Structured BRD data with chunks
   ↓
4. BedrockLLMClient.validate_brd_quality() → 10 CTQ scores
   ↓
5. BedrockLLMClient.generate_gap_fixes() → AI-suggested fixes
   ↓
6. Frontend displays ValidationPage with gap fixes
   ↓
7. Human reviews and updates gap fixes (accept/edit/reject)
   ↓
8. POST /api/update-gap-fix (for each gap reviewed)

Stage 2: EPICs & User Stories
9. User clicks "Proceed to EPICs & User Stories"
   ↓
10. POST /api/proceed-to-stage/{job_id} with stage=EPICS
   ↓
11. GenerationPipeline._generate_epics_and_stories() → Background task
   ↓
12. GET /api/status (polling for completion)
   ↓
13. Frontend displays EpicsRefinementPage
   ↓
14. User can edit/delete epics and stories
   ↓
15. Optional: POST /api/generate-more (generate additional artifacts)

Stage 3: Functional Tests
16. User clicks "Proceed to Functional Tests"
   ↓
17. POST /api/proceed-to-stage/{job_id} with stage=FUNCTIONAL_TESTS
   ↓
18. GenerationPipeline._generate_functional_tests() → Background task
   ↓
19. Frontend displays FunctionalTestsRefinementPage
   ↓
20. User can edit/delete functional tests, generate more

Stage 4: Gherkin Tests
21. POST /api/proceed-to-stage/{job_id} with stage=GHERKIN_TESTS
   ↓
22. GenerationPipeline._generate_gherkin_tests() → Background task
   ↓
23. Frontend displays GherkinTestsRefinementPage

Stage 5: Data Model
24. POST /api/proceed-to-stage/{job_id} with stage=DATA_MODEL
   ↓
25. GenerationPipeline._generate_data_model() → Background task
   ↓
26. Frontend displays DataModelPage with Mermaid diagram

Stage 6: Code Generation
27. POST /api/proceed-to-stage/{job_id} with stage=CODE_GENERATION
   ↓
28. GenerationPipeline._generate_code_skeleton() → Background task
   ↓
29. Frontend displays CodeSkeletonPage with file tree

Stage 7: Summary and Download
30. User clicks "Proceed to Summary"
   ↓
31. Frontend displays SummaryPage
   ↓
32. GET /api/download/{job_id} → ZIP file with all artifacts
```

**Key Features**:
- User approval required before each stage progression
- Edit/delete operations available at EPICs, Stories, Tests stages
- Stage history prevents duplicate regeneration
- Background tasks for all LLM operations
- Real-time polling for progress updates

---

## Quality Validation System

### 10 Critical-to-Quality (CTQ) Dimensions

1. **Completeness**: Business scenarios, exception flows, regulatory requirements
2. **Clarity & Unambiguity**: Clear wording, defined terms, consistent vocabulary
3. **Accuracy & Alignment**: Alignment with objectives, process maps, regulations
4. **Testability**: Verifiable requirements, acceptance criteria
5. **Traceability**: Links across objectives, processes, data, stories, tests
6. **Feasibility**: Technical and operational feasibility
7. **Consistency**: No conflicting requirements or contradictions
8. **Prioritisation**: Clear prioritization schema (MoSCoW, etc.)
9. **NFR Coverage**: Non-functional requirements (performance, security, audit)
10. **Stakeholder Validation**: Stakeholder responsibilities, RACI, sign-offs

### Scoring System
- Each dimension scored 0-5
- Overall score calculated as average
- Detailed findings and recommendations per dimension
- Key gaps extracted for remediation

---

## Human-in-the-Loop (HITL) Design

### Gap Fix Review Workflow

1. **AI Generation**: Claude suggests fixes for identified gaps
2. **User Review**: Frontend presents gap fixes with:
   - Gap description
   - Affected section
   - Current text (if applicable)
   - AI-suggested fix
   - Rationale and confidence level
3. **User Actions**:
   - **Accept**: Use AI suggestion as-is
   - **Edit & Accept**: Modify AI suggestion before accepting
   - **Reject**: Discard AI suggestion
4. **State Tracking**: Each gap tracks `user_action` and `final_text`
5. **Proceed When Ready**: User can proceed to generation after reviewing

---

## Design Patterns

### 1. Repository Pattern
- `JobManager` acts as in-memory repository
- CRUD operations for job state

### 2. Pipeline Pattern
- `GenerationPipeline` orchestrates sequential steps
- Each step independent and self-contained

### 3. Strategy Pattern
- Multiple LLM generation strategies (epics, tests, code)
- Configurable artifact generation

### 4. Retry Pattern
- Exponential backoff for Bedrock API throttling
- Graceful degradation on failures

---

## Security Considerations

### Current Implementation
- No authentication/authorization
- Local development only (CORS restricted)
- AWS credentials from environment/boto3 defaults

### Production Requirements
- Add JWT authentication
- Implement user sessions
- Secure AWS credentials (IAM roles, secrets manager)
- Rate limiting per user
- Input sanitization and validation
- File upload virus scanning

---

## Scalability Considerations

### Current Limitations
- In-memory job state (not persistent)
- Synchronous file processing
- Single-server deployment
- No horizontal scaling

### Future Improvements
- Database for job persistence (PostgreSQL/MongoDB)
- Message queue for background tasks (Celery, RabbitMQ)
- Object storage for uploaded files (S3)
- Redis for caching and session management
- Load balancer for multiple API instances
- Kubernetes for container orchestration

---

## Technology Decisions

### Why FastAPI?
- Async support for long-running tasks
- Automatic OpenAPI documentation
- Pydantic integration for validation
- Modern Python 3.8+ features

### Why React?
- Component-based architecture
- TypeScript for type safety
- Rich ecosystem for UI components
- Vite for fast development builds

### Why AWS Bedrock?
- Managed LLM service (no infrastructure)
- Claude 3.5 Sonnet v2 for quality
- Pay-per-use pricing
- Enterprise-grade security and compliance

### Why In-Memory Storage?
- MVP/prototype simplicity
- Fast development iteration
- Sufficient for development/demo
- **Note**: Not production-ready

---

## Performance Characteristics

### Frontend
- Initial load: ~1-2s
- Hot module reload: ~100-300ms
- Navigation: Client-side routing (instant)

### Backend
- BRD parsing (.docx): ~1-3s
- Single LLM call: ~5-15s
- Full generation pipeline: ~2-5 minutes
- File download: ~500ms-2s

### Bottlenecks
- AWS Bedrock API rate limits
- Sequential LLM calls (not parallelized)
- Large BRD document parsing

---

## Monitoring and Observability

### Current Implementation
- Console logging for debugging
- Basic error handling with try/catch
- Job status tracking

### Recommended Additions
- Structured logging (JSON format)
- Application Performance Monitoring (APM)
- Error tracking (Sentry, Rollbar)
- Metrics collection (Prometheus, Grafana)
- Distributed tracing (OpenTelemetry)
