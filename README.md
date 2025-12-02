# SpecPilot

> Transform Business Requirements Documents into Technical Artifacts with AI

SpecPilot is an AI-powered tool that converts Business Requirements Documents (BRDs) into production-ready technical artifacts including user stories, test cases, data models, and code skeletons.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)

---

## 🚀 Features

### Two-Step Workflow with Human-in-the-Loop

1. **BRD Quality Validation**
   - Evaluates BRD across 10 Critical-to-Quality (CTQ) dimensions
   - Generates AI-suggested fixes for identified gaps
   - Human review and approval before generation

2. **Artifact Generation**
   - **Epics & User Stories** with acceptance criteria
   - **Functional Test Cases** with detailed steps
   - **Gherkin BDD Scenarios** for automated testing
   - **Data Models** with entity-relationship diagrams (Mermaid)
   - **Code Skeleton** (ASP.NET Core API structure)

### Key Capabilities

- **Document Parsing**: Supports .docx and .txt BRD files
- **AI-Powered Analysis**: Uses AWS Bedrock (Claude 3.5 Sonnet v2)
- **Quality Validation**: 10-dimensional CTQ scoring system
- **Interactive Review**: Review and edit AI suggestions before proceeding
- **Real-time Progress**: Live updates during generation
- **Downloadable Results**: Export all artifacts as ZIP

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

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

Create a `.env` file in the `backend/` directory (optional):

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Server Configuration (optional)
PORT=8000
HOST=0.0.0.0
```

### Frontend Configuration

The frontend is pre-configured to connect to `http://localhost:8000/api`.

To change the API URL, edit `frontend/src/lib/api.ts`:

```typescript
const API_BASE_URL = 'http://localhost:8000/api';
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

#### Step 1: Upload BRD and Validate

1. Open `http://localhost:5173` in your browser
2. Upload your BRD file (.docx or .txt, max 15MB)
3. Configure which artifacts to generate:
   - ✅ Epics & User Stories
   - ✅ Data Model
   - ✅ Functional Tests
   - ✅ Gherkin Tests
   - ✅ Code Skeleton
4. Click **"Generate Artifacts"**
5. Wait for validation to complete (~30 seconds)

#### Step 2: Review Validation Results

1. Review **Overall Quality Score** (0-5 scale)
2. Examine **CTQ Dimension Scores** across 10 categories
3. Review **Identified Gaps** with AI-suggested fixes
4. For each gap:
   - **Accept** the AI suggestion as-is
   - **Edit & Accept** to modify the suggestion
   - **Reject** to discard the suggestion

#### Step 3: Generate Artifacts

1. Click **"Proceed to Generation"** after reviewing gaps
2. Monitor real-time progress as artifacts are generated
3. Wait for completion (~2-5 minutes)
4. Download results as ZIP file

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
│   │   ├── pages/             # Page components
│   │   │   ├── HomePage.tsx           # Upload page
│   │   │   ├── ValidationPage.tsx     # Review page
│   │   │   ├── ProgressPage.tsx       # Progress tracker
│   │   │   └── ResultsPage.tsx        # Results viewer
│   │   ├── lib/               # Utilities and API client
│   │   └── main.tsx           # Entry point
│   └── package.json           # Node dependencies
├── docs/                      # Documentation
│   ├── API.md                 # API reference
│   ├── ARCHITECTURE.md        # System architecture
│   ├── PROJECT_SPEC.md        # Original specification
│   ├── VALIDATION_IMPLEMENTATION.md  # Validation system
│   └── UI_IMPROVEMENTS.md     # UI enhancement log
├── .gitignore
├── README.md
└── CONTRIBUTING.md            # Contribution guidelines
```

---

## 📚 API Documentation

See [docs/API.md](docs/API.md) for complete API reference.

### Key Endpoints

- `POST /api/validate-brd` - Upload and validate BRD
- `POST /api/update-gap-fix/{job_id}` - Update gap fix review
- `POST /api/proceed-to-generation/{job_id}` - Start generation
- `GET /api/status/{job_id}` - Poll for progress
- `GET /api/download/{job_id}` - Download artifacts

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

### Automated Testing (Planned)

- Backend unit tests with pytest
- Frontend component tests with Vitest
- E2E tests with Playwright
- API integration tests

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following coding standards
4. Commit with conventional commits: `feat(scope): description`
5. Push and create a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **AWS Bedrock** for providing Claude 3.5 Sonnet v2 API
- **Anthropic** for the Claude language model
- **FastAPI** and **React** communities for excellent frameworks

---

## 📞 Support

- **Documentation**: See `docs/` folder
- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/SpecPilot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/SpecPilot/discussions)

---

## 🗺️ Roadmap

### Current Version (v1.0)
- ✅ BRD quality validation with 10 CTQ dimensions
- ✅ Human-in-the-loop gap review
- ✅ Artifact generation (Epics, Stories, Tests, Code)
- ✅ Real-time progress tracking
- ✅ Downloadable results as ZIP

### Planned Features (v2.0)
- [ ] Database persistence for jobs
- [ ] User authentication and sessions
- [ ] Multi-user support
- [ ] Export to Jira/Azure DevOps
- [ ] Custom CTQ dimension configuration
- [ ] Batch BRD processing
- [ ] API rate limiting and quotas
- [ ] Enhanced code generation (multiple languages)
- [ ] AI-powered test data generation

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
