# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpecPilot is an AI-powered tool that transforms Business Requirements Documents (BRDs) into technical artifacts (epics, user stories, functional tests, Gherkin BDD tests, data models, and Java Selenium/Cucumber code skeletons) using AWS Bedrock (Claude 3.5 Sonnet v2).

## Development Commands

### Backend (FastAPI, Python)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run dev server
uvicorn app.main:app --reload --port 8000

# With corporate proxy
HTTP_PROXY=http://... HTTPS_PROXY=http://... uvicorn app.main:app --reload --port 8000
```

### Frontend (React, TypeScript, Vite)

```bash
cd frontend
npm install
npm run dev          # Dev server on port 5173
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

### Run Both Together

```bash
./start-all.sh         # macOS/Linux
start.bat              # Windows
./start-with-proxy.sh  # With corporate proxy
```

### Environment Setup

Copy `backend/.env.example` to `backend/.env` and set:
- `AWS_REGION` (required)
- `AWS_ACCESS_KEY_ID` (required)
- `AWS_SECRET_ACCESS_KEY` (required)
- `AWS_BEDROCK_MODEL_ID` (optional, defaults to `us.anthropic.claude-3-5-sonnet-20241022-v2:0`)

## Architecture

### 8-Stage Workflow

The app follows a linear stage progression, each with its own route and backend endpoint:

1. **ConfigurationPage** (`/`) — BRD upload, triggers `POST /api/validate-brd`
2. **ValidationPage** (`/validation/:jobId`) — CTQ quality review, gap fix approval
3. **EpicsRefinementPage** (`/epics/:jobId`) — Edit/delete epics and user stories
4. **FunctionalTestsRefinementPage** (`/functional-tests/:jobId`) — Edit/delete functional tests
5. **GherkinTestsRefinementPage** (`/gherkin-tests/:jobId`) — Edit/delete Gherkin BDD tests
6. **DataModelPage** (`/data-model/:jobId`) — Mermaid ER diagram visualization
7. **SummaryPage** (`/summary/:jobId`) — Download all artifacts as ZIP

Stage progression is driven by `POST /api/proceed-to-stage/{job_id}`. Each stage's frontend page polls `GET /api/status/{job_id}` to track background LLM generation. DataModelPage navigates directly to SummaryPage (no intermediate code generation stage).

### Backend Service Layer

```
backend/app/
├── main.py                    # FastAPI app, CORS config (ports 5173-5175)
├── config.py                  # Env var loading, AWS credential validation
├── models/schemas.py          # All Pydantic v2 models (JobStatus, Epic, UserStory, etc.)
├── routes/
│   ├── shared_endpoints.py    # CRUD ops, download, status polling
│   └── staged_endpoints.py    # Stage progression, validate-brd, generate-more
└── services/
    ├── brd_parser.py          # .docx/.txt parsing with section hierarchy
    ├── llm_client.py          # AWS Bedrock client, JSON extraction, retry logic
    ├── generation_pipeline.py # Orchestrates the 7-stage artifact generation
    └── job_manager.py         # In-memory job store (lost on restart)
```

**Important**: `job_manager.py` uses in-memory state only — all jobs are lost when the backend restarts.

### Frontend Structure

```
frontend/src/
├── App.tsx                    # React Router config for all 8 stages
├── types/index.ts             # All TypeScript interfaces (shared with backend schemas)
├── lib/api.ts                 # Axios client wrapping all backend endpoints
├── pages/                     # One page per stage (see workflow above)
└── components/
    ├── ui/                    # Reusable primitives (Button, Card, Toast, etc.)
    └── Editable*.tsx          # In-place editing components for artifacts
```

The frontend path alias `@/` maps to `src/`.

### LLM Integration

`llm_client.py` calls AWS Bedrock with structured prompts expecting JSON responses. Key behaviors:
- Extracts JSON from markdown code blocks if the model wraps output
- Exponential backoff retry on throttling errors
- Supports 10 CTQ validation dimensions scored 0–5
- Log options via `LOG_LLM_ERRORS`, `LOG_LLM_SUCCESS` env vars

### Data Flow

```
BRD Upload → brd_parser → section chunks → llm_client (Bedrock)
→ generation_pipeline → job_manager (in-memory state)
→ Frontend polls /api/status/:jobId → renders artifacts → user edits
→ /api/proceed-to-stage → next LLM generation stage
→ /api/download → ZIP of all artifacts
```

## Key Conventions

- **Job IDs** are UUID strings passed in all routes and API calls
- **Stage names** match across frontend routes, backend endpoints, and `PipelineStage` enum in `types/index.ts`
- Backend CORS is hardcoded to `localhost:5173, 5174, 5175` — update `main.py` for other ports
- The `generated/` directory in `backend/` holds downloadable artifact files
- Frontend Editable components (`EditableEpic`, `EditableStory`, etc.) call their respective `PUT` endpoints on save and `DELETE` on removal
