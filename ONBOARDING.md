# SpecPilot - Developer Onboarding Guide

Welcome to SpecPilot! This guide will help you understand the project, set up your development environment, and start contributing.

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Environment Setup](#environment-setup)
6. [Project Structure](#project-structure)
7. [Development Workflow](#development-workflow)
8. [Key Concepts](#key-concepts)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**SpecPilot** is an intelligent automation platform that transforms Business Requirements Documents (BRDs) into structured specifications and executable test automation code.

### What It Does

- **Parses BRDs**: Accepts PDF, DOCX, TXT formats
- **Validates Requirements**: Uses AI to identify gaps and ambiguities
- **Generates Artifacts**:
  - EPICs and User Stories
  - Functional Test Cases
  - Gherkin BDD Scenarios
  - Data Models with ER Diagrams
  - Java Selenium + Cucumber Code Skeleton

### Key Features

- **Staged Pipeline**: Progressive generation through validation → epics → tests → data model → code
- **Interactive Refinement**: Edit and regenerate artifacts at each stage
- **AI-Powered**: Uses AWS Bedrock (Claude 3.5 Sonnet) for intelligent analysis
- **Export Ready**: Download complete test automation framework

---

## System Architecture

### High-Level Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │ ───> │   Frontend   │ ───> │   Backend   │
│  (React)    │ <─── │   (Vite)     │ <─── │  (FastAPI)  │
└─────────────┘      └──────────────┘      └─────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ AWS Bedrock  │
                                            │ Claude 3.5   │
                                            └──────────────┘
```

### Pipeline Flow

```
Upload BRD
    │
    ▼
Validation (Gap Detection)
    │
    ▼
EPIC & User Story Generation
    │
    ▼
Functional Test Generation
    │
    ▼
Gherkin BDD Scenario Generation
    │
    ▼
Data Model & ER Diagram
    │
    ▼
Code Skeleton (Java + Selenium + Cucumber)
    │
    ▼
Download ZIP
```

---

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.8+)
- **LLM Integration**: AWS Bedrock (boto3)
- **Document Parsing**: PyMuPDF, python-docx
- **File Handling**: python-multipart
- **CORS**: fastapi.middleware.cors

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: TailwindCSS
- **Icons**: Lucide React

### AI/ML
- **LLM**: Anthropic Claude 3.5 Sonnet via AWS Bedrock
- **Region**: us-east-1
- **Model**: `us.anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## Prerequisites

### Required Software

1. **Python 3.8+**
   ```bash
   python3 --version
   ```

2. **Node.js 16+** and **npm**
   ```bash
   node --version
   npm --version
   ```

3. **AWS Account** with Bedrock access
   - Must have access to Claude 3.5 Sonnet in us-east-1
   - IAM credentials configured

### AWS Setup

1. **Request Bedrock Model Access**:
   - Go to AWS Console → Bedrock → Model Access
   - Request access to "Anthropic Claude 3.5 Sonnet"
   - Wait for approval (usually instant)

2. **Configure AWS Credentials**:
   ```bash
   aws configure
   # OR set environment variables:
   export AWS_ACCESS_KEY_ID="your-access-key"
   export AWS_SECRET_ACCESS_KEY="your-secret-key"
   export AWS_DEFAULT_REGION="us-east-1"
   ```

3. **Corporate Proxy** (if applicable):
   - See [CORPORATE_SETUP.md](CORPORATE_SETUP.md) for proxy configuration
   - See [CORPORATE_PROXY_TROUBLESHOOTING.md](CORPORATE_PROXY_TROUBLESHOOTING.md) for common issues

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SpecPilot
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env with your AWS credentials
nano .env
```

**Required .env variables**:
```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1

# Optional: Corporate Proxy
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
```

### 4. Start Development Servers

**Option A: Using Startup Scripts** (Recommended)

```bash
# From project root
./start-all.sh          # macOS/Linux
start-all.bat           # Windows

# With corporate proxy:
./start-with-proxy.sh   # macOS/Linux
start-with-proxy.bat    # Windows
```

**Option B: Manual Start**

Terminal 1 (Backend):
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173 (or 5174, 5175 if port busy)
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Project Structure

```
SpecPilot/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── config.py          # Configuration management
│   │   ├── models/
│   │   │   ├── __init__.py    # Model exports
│   │   │   └── schemas.py     # Pydantic models
│   │   ├── routes/
│   │   │   ├── generation.py          # CRUD endpoints
│   │   │   └── staged_endpoints.py    # Pipeline progression
│   │   └── services/
│   │       ├── brd_parser.py           # Document parsing
│   │       ├── llm_client.py           # AWS Bedrock client
│   │       ├── generation_pipeline.py  # Main generation logic
│   │       ├── java_code_generator.py  # Code skeleton builder
│   │       └── job_manager.py          # Job state management
│   ├── generated/             # Output directory (gitignored)
│   ├── venv/                  # Python virtual env (gitignored)
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment variables (gitignored)
│
├── frontend/                  # React + Vite frontend
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Root component with routing
│   │   ├── components/
│   │   │   ├── ui/           # Reusable UI components
│   │   │   ├── EditableEpic.tsx
│   │   │   ├── EditableStory.tsx
│   │   │   ├── EditableFunctionalTest.tsx
│   │   │   ├── EditableGherkinTest.tsx
│   │   │   ├── GenerateMorePanel.tsx
│   │   │   └── StageProgressIndicator.tsx
│   │   ├── pages/
│   │   │   ├── ConfigurationPage.tsx   # Upload BRD
│   │   │   ├── ValidationPage.tsx      # Gap fixes
│   │   │   ├── EpicsRefinementPage.tsx
│   │   │   ├── FunctionalTestsRefinementPage.tsx
│   │   │   ├── GherkinTestsRefinementPage.tsx
│   │   │   ├── DataModelPage.tsx
│   │   │   ├── CodeSkeletonPage.tsx
│   │   │   └── SummaryPage.tsx
│   │   ├── lib/
│   │   │   ├── api.ts        # API client
│   │   │   └── utils.ts      # Utility functions
│   │   └── types/
│   │       └── index.ts      # TypeScript types
│   ├── node_modules/         # npm packages (gitignored)
│   ├── package.json          # npm dependencies
│   └── vite.config.ts        # Vite configuration
│
├── docs/                      # Documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── PROJECT_SPEC.md
│   └── ...
│
├── .gitignore
├── README.md
├── ONBOARDING.md             # This file
└── CODEBASE_GUIDE.md         # Detailed file explanations
```

---

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# ... edit files ...

# Test locally
./start-all.sh

# Commit changes
git add .
git commit -m "feat: add your feature description"

# Push to remote
git push origin feature/your-feature-name
```

### 2. Testing a Full Pipeline

1. **Start servers**: `./start-all.sh`
2. **Open browser**: http://localhost:5173
3. **Upload BRD**: Use sample BRD from `docs/` (if available) or create one
4. **Follow pipeline**:
   - Validation → Review gaps
   - Epics → Edit/add epics
   - Functional Tests → Refine tests
   - Gherkin Tests → Edit scenarios
   - Data Model → Review entities
   - Code Skeleton → Download ZIP

### 3. Making Backend Changes

1. **Edit Python files** in `backend/app/`
2. **Server auto-reloads** (uvicorn --reload)
3. **Check logs** in terminal
4. **Test endpoints** at http://localhost:8000/docs

### 4. Making Frontend Changes

1. **Edit React files** in `frontend/src/`
2. **Vite HMR** (Hot Module Replacement) updates browser instantly
3. **Check browser console** for errors
4. **Test UI** in browser

---

## Key Concepts

### 1. Staged Pipeline Architecture

SpecPilot uses a **staged pipeline** where each stage generates artifacts that feed into the next:

- **Stage 1: Validation** - Parse BRD, detect gaps
- **Stage 2: Epics** - Generate EPICs and User Stories
- **Stage 3: Functional Tests** - Create test cases from stories
- **Stage 4: Gherkin Tests** - BDD scenarios from test cases
- **Stage 5: Data Model** - Extract entities and relationships
- **Stage 6: Code Generation** - Java Selenium + Cucumber framework

Each stage can be **regenerated** or **refined** before proceeding.

### 2. Job State Management

- **Job ID**: UUID identifying each generation job
- **Job State**: Stored in-memory (JobManager)
- **Stage History**: Tracks completed stages
- **Results**: Cumulative artifacts from all stages

### 3. LLM Integration

- **Client**: `llm_client.py` - AWS Bedrock wrapper
- **Retry Logic**: Exponential backoff (2s → 4s → 8s → 16s → 32s)
- **Max Retries**: 5 attempts
- **Timeout**: 300 seconds (5 minutes)
- **Max Tokens**: 16,384 tokens per response

### 4. Editable Artifacts

Every artifact (epic, story, test, scenario) has:
- **View Mode**: Display artifact
- **Edit Mode**: Inline editing
- **Save/Cancel**: Persist or discard changes
- **Delete**: Remove artifact

### 5. Generate More Feature

At each stage, users can request additional artifacts:
- **Instructions**: Natural language prompt
- **Context**: Existing artifacts provide context
- **Incremental**: New artifacts append to existing

---

## Common Tasks

### Add a New Artifact Type

**Backend**:
1. Add Pydantic model to `models/schemas.py`
2. Add generation logic to `generation_pipeline.py`
3. Update `PipelineStage` enum in `schemas.py`
4. Add API endpoint in `staged_endpoints.py`

**Frontend**:
1. Add TypeScript type to `types/index.ts`
2. Create page in `pages/`
3. Create editable component in `components/`
4. Add route to `App.tsx`
5. Update `api.ts` with new endpoints

### Modify LLM Prompts

Edit prompts in:
- `llm_client.py` - Main prompt templates
- `generation_pipeline.py` - Stage-specific prompts

**Testing prompt changes**:
```bash
# Increase logging verbosity
# Edit llm_client.py to print prompts:
print(f"Prompt: {prompt}")
```

### Change AWS Region or Model

Edit `backend/app/services/llm_client.py`:

```python
self.bedrock = boto3.client(
    service_name='bedrock-runtime',
    region_name='us-east-1',  # Change region here
    config=Config(**boto_config_params)
)

# Change model ID
model_id = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
```

### Add New UI Page

1. **Create page component**: `frontend/src/pages/NewPage.tsx`
2. **Add route**: Edit `App.tsx`:
   ```tsx
   <Route path="/new-page/:jobId" element={<NewPage />} />
   ```
3. **Add navigation**: Link from existing pages
4. **Add API calls**: Update `api.ts` if needed

### Increase API Quotas

If you hit AWS Bedrock rate limits:

1. **AWS Console** → Bedrock → Service Quotas
2. Request increase for:
   - "Requests per minute"
   - "Tokens per minute"
3. Wait for approval (usually 1-2 days)

Alternatively, increase retry delays in `llm_client.py`:
```python
self.base_delay = 5  # Increase from 2 to 5 seconds
```

---

## Troubleshooting

### Backend won't start

**Error**: `ModuleNotFoundError: No module named 'dotenv'`
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**Error**: `AWS credentials not found`
```bash
# Check .env file exists and has correct values
cat .env

# Or set environment variables
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
```

### Frontend won't start

**Error**: `Cannot find module 'react'`
```bash
cd frontend
npm install
```

**Error**: `Port 5173 already in use`
- Vite will automatically try 5174, 5175
- Or kill existing process: `lsof -ti:5173 | xargs kill`

### Corporate Proxy Issues

See [CORPORATE_PROXY_TROUBLESHOOTING.md](CORPORATE_PROXY_TROUBLESHOOTING.md)

Common fixes:
1. Set proxy in `.env`:
   ```env
   HTTP_PROXY=http://proxy.company.com:8080
   HTTPS_PROXY=http://proxy.company.com:8080
   NO_PROXY=localhost,127.0.0.1
   ```
2. Use proxy startup scripts:
   ```bash
   ./start-with-proxy.sh
   ```

### Code Generation Timeout

**Error**: "Code generation is taking longer than expected"

**Causes**:
- Large BRD (>100 pages)
- Complex data model (>20 entities)
- AWS Bedrock throttling

**Solutions**:
1. **Increase timeout** in `llm_client.py`:
   ```python
   'read_timeout': 600  # 10 minutes
   ```
2. **Reduce max_tokens** for faster generation:
   ```python
   "max_tokens": 8192
   ```
3. **Request AWS quota increase**

### "Job not found" Error

**Cause**: Backend restarted (in-memory state lost)

**Solution**:
- Jobs are stored in-memory only
- Restart = lose all jobs
- Upload BRD again to create new job

**Future**: Implement persistent storage (Redis, PostgreSQL)

---

## Next Steps

1. **Read** [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) for detailed file-by-file explanations
2. **Review** [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design details
3. **Check** [API.md](docs/API.md) for API endpoint documentation
4. **Explore** the code - start with `backend/app/main.py` and `frontend/src/App.tsx`
5. **Try** generating a sample project to understand the flow

---

## Support

For questions or issues:
- Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) (if exists)
- Review existing documentation in `docs/`
- Check backend logs in terminal
- Check browser console for frontend errors

---

## Contributing

1. Follow existing code style
2. Add comments for complex logic
3. Update documentation when adding features
4. Test thoroughly before committing
5. Write clear commit messages

---

**Happy Coding! 🚀**
