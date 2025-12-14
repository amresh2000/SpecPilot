# SpecPilot

> Transform Business Requirements Documents into Technical Artifacts with AI

SpecPilot is an AI-powered tool that converts Business Requirements Documents (BRDs) into production-ready technical artifacts including user stories, test cases, data models, and code skeletons.

## 🚀 Features

### Staged Pipeline with Human-in-the-Loop

1. **BRD Quality Validation** (Stage 1)

   - Evaluates BRD across 10 Critical-to-Quality (CTQ) dimensions
   - Generates AI-suggested fixes for identified gaps
   - Human review and approval before proceeding to each stage

2. **Six-Stage Artifact Generation** (Stages 2-7)
   - **Stage 2: Epics & User Stories** with acceptance criteria (editable, deletable)
   - **Stage 3: Functional Test Cases** with detailed steps (editable, deletable)
   - **Stage 4: Gherkin BDD Scenarios** for automated testing (editable, deletable)
   - **Stage 5: Data Models** with entity-relationship diagrams (Mermaid)
   - **Stage 6: Code Skeleton** (Java Selenium + Cucumber test automation framework)
   - **Stage 7: Summary** with downloadable ZIP containing all artifacts

### Key Capabilities

- **Document Parsing**: Supports .docx and .txt BRD files with section-based chunking
- **AI-Powered Analysis**: Uses AWS Bedrock (Claude 3.5 Sonnet v2)
- **Quality Validation**: 10-dimensional CTQ scoring system with AI-suggested gap fixes
- **Interactive Review**: Review, edit, and approve each stage before progression
- **Full CRUD Operations**: Edit and delete generated epics, stories, and tests
- **Real-time Progress**: Live updates during generation with step-by-step tracking
- **Java Test Automation**: Complete Selenium + Cucumber framework with POM pattern
- **Downloadable Results**: Export all artifacts as ZIP with organized structure

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)

---

## 🔧 Prerequisites

### Required Software

- **Python 3.8+** with pip
- **Node.js 18+** with npm
- **AWS Account** with Bedrock access
- **Git** for version control

### AWS Setup

1. **Enable AWS Bedrock** in your AWS account
2. **Request access** to Claude 3.5 Sonnet v2 model:
   - Go to AWS Bedrock Console
   - Navigate to "Model access"
   - Request access to Anthropic Claude models
3. **Configure AWS credentials**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your Secret Access Key
   # Default region: us-east-1
   ```

---

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/SpecPilot.git
cd SpecPilot
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

---

## ⚙️ Configuration

### Backend Configuration

**REQUIRED**: Create a `.env` file in the `backend/` directory:

```bash
# Copy the example file and customize
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your configuration:

```bash
# AWS Bedrock Configuration (REQUIRED)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here

# Corporate Proxy Configuration (Optional)
# Uncomment if using SPNEGO or corporate proxy
# HTTP_PROXY=http://127.0.0.1:8888
# HTTPS_PROXY=http://127.0.0.1:8888
# NO_PROXY=localhost,127.0.0.1

# Jira Integration (Optional - Future Feature)
# JIRA_URL=https://yourcompany.atlassian.net
# JIRA_EMAIL=your-email@company.com
# JIRA_API_TOKEN=your-api-token
# JIRA_PROJECT_KEY=PROJ

# Application Settings
PORT=8000
```

#### Corporate Environment Setup

If using SpecPilot in a corporate environment with proxy/SSO:

1. **Start your SPNEGO proxy** (if applicable):
   ```bash
   # Windows
   start-proxy.bat

   # This runs proxy on 127.0.0.1:8888
   ```

2. **Configure proxy in .env**:
   ```bash
   HTTP_PROXY=http://127.0.0.1:8888
   HTTPS_PROXY=http://127.0.0.1:8888
   NO_PROXY=localhost,127.0.0.1
   ```

3. **SSL Certificate (if needed)**:
   ```bash
   # For self-signed corporate certificates
   REQUESTS_CA_BUNDLE=/path/to/corporate-ca-bundle.crt
   ```

The application automatically routes all AWS Bedrock and Jira API calls through the configured proxy.

### Frontend Configuration

The frontend is pre-configured to connect to `http://localhost:8000/api`.

To change the API URL, edit `frontend/src/lib/api.ts`:

```typescript
const API_BASE_URL = "http://localhost:8000/api";
```

---

## 🎯 Usage

### Quick Start with Startup Scripts

**Option 1: Start Everything (Recommended)**

```bash
# macOS/Linux
./start-all.sh

# Windows
start.bat
```

This opens separate terminal windows for backend and frontend automatically.

**Option 2: Start Manually**

Backend:

```bash
./start-backend.sh  # macOS/Linux
```

Frontend:

```bash
./start-frontend.sh  # macOS/Linux
```

### Manual Start (Alternative)

**Backend**:

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
./venv/bin/uvicorn app.main:app --reload --port 8000
```

**Frontend**:

```bash
cd frontend
npm run dev
```

### Access Points

- **Backend API**: `http://localhost:8000`
- **API Documentation**: `http://localhost:8000/docs`
- **Frontend UI**: `http://localhost:5173`
- **Health Check**: `http://localhost:8000/health`

### Using the Application

#### Stage 1: Upload BRD and Validate Quality

1. Open `http://localhost:5173` in your browser
2. Upload your BRD file (.docx or .txt, max 15MB)
3. Optionally provide custom instructions for generation
4. Click **"Generate Artifacts"**
5. Wait for validation to complete (~30-60 seconds)

#### Stage 2: Review Validation Results

1. Review **Overall Quality Score** (0-5 scale)
2. Examine **CTQ Dimension Scores** across 10 categories
3. Review **Identified Gaps** with AI-suggested fixes
4. For each gap:
   - **Accept** the AI suggestion as-is
   - **Edit & Accept** to modify the suggestion
   - **Reject** to discard the suggestion
5. Click **"Proceed to EPICs & User Stories"**

#### Stages 3-7: Progressive Artifact Generation

**Stage 3: EPICs & User Stories**
- Review generated epics and user stories with acceptance criteria
- Edit or delete any artifact using the UI
- Click **"Generate More"** to create additional stories
- Click **"Proceed to Functional Tests"** when satisfied

**Stage 4: Functional Tests**
- Review functional test cases linked to user stories
- Edit or delete tests as needed
- Generate more tests for specific stories
- Click **"Proceed to Gherkin Tests"**

**Stage 5: Gherkin Tests**
- Review BDD scenarios in Gherkin format
- Edit or delete scenarios
- Generate additional Gherkin tests
- Click **"Proceed to Data Model"**

**Stage 6: Data Model**
- Review entity-relationship model with Mermaid diagram
- Visualize data structure interactively
- Click **"Proceed to Code Generation"**

**Stage 7: Code Skeleton**
- Review generated Java Selenium + Cucumber framework
- Explore file tree structure with POM pattern
- Preview generated code files
- Click **"Proceed to Summary"**

#### Stage 8: Download and Complete

1. Review all generated artifacts in summary view
2. Download complete project as ZIP file
3. ZIP contains organized folders with all artifacts

---

## 📁 Project Structure

```
SpecPilot/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # Application entry point
│   │   ├── models/
│   │   │   └── schemas.py     # Pydantic data models
│   │   ├── routes/
│   │   │   └── generation.py  # API endpoints
│   │   └── services/
│   │       ├── brd_parser.py          # Document parsing
│   │       ├── llm_client.py          # AWS Bedrock client
│   │       ├── generation_pipeline.py # Orchestration
│   │       └── job_manager.py         # State management
│   ├── generated/             # Output directory
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components (8 stages)
│   │   │   ├── ConfigurationPage.tsx          # BRD upload
│   │   │   ├── ValidationPage.tsx             # Quality review
│   │   │   ├── EpicsRefinementPage.tsx        # EPICs & Stories
│   │   │   ├── FunctionalTestsRefinementPage.tsx  # Functional Tests
│   │   │   ├── GherkinTestsRefinementPage.tsx     # Gherkin Tests
│   │   │   ├── DataModelPage.tsx              # Data Model
│   │   │   ├── CodeSkeletonPage.tsx           # Code Preview
│   │   │   └── SummaryPage.tsx                # Download
│   │   ├── lib/               # Utilities and API client
│   │   └── main.tsx           # Entry point
│   └── package.json           # Node dependencies
├── docs/                      # Documentation
│   ├── API.md                 # API reference
│   ├── ARCHITECTURE.md        # System architecture
│   └── PROJECT_SPEC.md        # Original specification
├── .gitignore
├── README.md
└── CONTRIBUTING.md            # Contribution guidelines
```

---

## 📚 API Documentation

See [docs/API.md](docs/API.md) for complete API reference.

### Key Endpoints

**Staged Pipeline**:
- `POST /api/validate-brd` - Upload and validate BRD (Stage 1)
- `POST /api/update-gap-fix/{job_id}` - Update gap fix review
- `POST /api/proceed-to-stage/{job_id}` - Progress to next stage (Stages 2-7)
- `POST /api/generate-more/{job_id}` - Generate additional artifacts at current stage

**CRUD Operations**:
- `PUT /api/epics/{epic_id}` - Update epic
- `DELETE /api/epics/{epic_id}` - Delete epic (cascade delete stories)
- `PUT /api/stories/{story_id}` - Update user story
- `DELETE /api/stories/{story_id}` - Delete story (cascade delete tests)
- `PUT /api/tests/{test_id}` - Update functional test
- `DELETE /api/tests/{test_id}` - Delete functional test
- `PUT /api/gherkin/{scenario_id}` - Update Gherkin scenario
- `DELETE /api/gherkin/{scenario_id}` - Delete Gherkin scenario

**Status and Download**:
- `GET /api/status/{job_id}` - Poll for progress
- `GET /api/download/{job_id}` - Download all artifacts as ZIP

---

## 🏗️ Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

### High-Level Overview

```
┌──────────────┐
│   React UI   │ ← User uploads BRD, reviews validation
└──────┬───────┘
       │ HTTP/REST
       ▼
┌──────────────┐
│  FastAPI API │ ← Orchestrates workflow
└──────┬───────┘
       │ Boto3 SDK
       ▼
┌──────────────┐
│ AWS Bedrock  │ ← Claude 3.5 Sonnet v2
│  (Claude)    │   Validation + Generation
└──────────────┘
```

### Technology Stack

**Backend**:

- FastAPI 0.115+ (async web framework)
- AWS Boto3 (Bedrock SDK)
- python-docx (document parsing)
- Pydantic v2 (data validation)

**Frontend**:

- React 18.3+ with TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Lucide React (icons)

**AI/ML**:

- AWS Bedrock
- Claude 3.5 Sonnet v2 (Anthropic)

---

## 10 Critical-to-Quality (CTQ) Dimensions

SpecPilot validates BRDs across these dimensions:

1. **Completeness** - Business scenarios, exception flows, regulatory requirements
2. **Clarity** - Clear wording, defined terms, consistent vocabulary
3. **Accuracy** - Alignment with objectives, process maps, regulations
4. **Testability** - Verifiable requirements, acceptance criteria
5. **Traceability** - Links across objectives, processes, data, stories, tests
6. **Feasibility** - Technical and operational feasibility
7. **Consistency** - No conflicting requirements or contradictions
8. **Prioritisation** - Clear prioritization schema (MoSCoW, etc.)
9. **NFR Coverage** - Non-functional requirements (performance, security, audit)
10. **Stakeholder Validation** - Stakeholder responsibilities, RACI, sign-offs

Each dimension is scored 0-5, with detailed findings and recommendations.

---

## 🧪 Testing

### Manual Testing

1. Test BRD upload with sample documents
2. Verify validation scores and gap fixes
3. Test gap fix review actions (accept/edit/reject)
4. Monitor generation progress
5. Verify downloaded artifacts

---

## 📊 Performance

- **BRD Upload**: < 2 seconds
- **Validation**: 20-40 seconds
- **Full Generation**: 2-5 minutes (depending on BRD size)
- **File Size Limit**: 15MB
- **Concurrent Users**: Development only (single instance)

---

## 🔐 Security

- **Input Validation**: All inputs validated with Pydantic
- **File Type Restriction**: Only .docx and .txt allowed
- **File Size Limit**: 15MB maximum
- **CORS**: Restricted to localhost in development
- **AWS Credentials**: Never exposed to frontend

**Production Security TODO**:

- Add authentication (JWT)
- Implement rate limiting
- Add input sanitization
- Secure file upload validation
- Enable HTTPS only

---

## 🐛 Known Issues

- In-memory job storage (lost on server restart)
- No authentication/authorization
- Single-server deployment only
- AWS Bedrock throttling during high usage (handled with retry logic)

---

## 💡 Tips

- **BRD Quality**: Higher quality BRDs produce better artifacts
- **Validation Review**: Take time to review gap fixes - they improve results
- **Large Documents**: Documents >100 pages may take longer to process
- **AWS Costs**: Monitor Bedrock API usage to control costs
- **Error Recovery**: If generation fails, check AWS credentials and Bedrock quotas

---

**Made with ❤️ by the SpecPilot Team**
