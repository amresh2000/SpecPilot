# Project Generator - BRD → Specs → Tests → Code

Transform Business Requirements Documents (BRDs) into structured specifications, tests, and code skeletons using AWS Bedrock (Claude 3.5 Sonnet).

## 🎯 Overview

This application:
- **Parses** BRD documents (.docx or .txt)
- **Generates** EPICs, User Stories, and Acceptance Criteria
- **Creates** Functional and Gherkin test cases
- **Designs** Data models with Mermaid ER diagrams
- **Scaffolds** ASP.NET Core API code skeleton

Built for hackathon demo (3-day timeline).

## 🏗️ Architecture

**Backend**: FastAPI (Python)
- BRD parsing with `python-docx`
- AWS Bedrock integration for LLM calls
- In-memory job state management
- ZIP generation for downloads

**Frontend**: React + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Real-time polling for progress updates
- Multi-page specifications viewer

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- AWS Bedrock access (us-east-1 region)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure AWS credentials
cp .env.example .env
# Edit .env and add your AWS credentials

# Run server
uvicorn app.main:app --reload --port 8000
```

Backend API: `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend app: `http://localhost:5173`

## 📋 Usage

1. **Upload BRD**: Go to `http://localhost:5173` and upload a `.docx` or `.txt` BRD file
2. **Configure**: Add optional instructions and select artifacts to generate
3. **Generate**: Click "Generate" to start the pipeline
4. **Monitor**: Watch real-time progress with step-by-step status
5. **Review**: Browse generated EPICs, User Stories, Tests, and Data Models
6. **Download**: Get ZIP with all artifacts or view code skeleton

## 🎨 Features

### Must-Have (Implemented)
- ✅ BRD parsing (.docx + .txt)
- ✅ 5 LLM calls for all artifact types
- ✅ EPICs & User Stories with source tracking
- ✅ Functional test cases
- ✅ Gherkin BDD scenarios
- ✅ Data model with Mermaid diagrams
- ✅ ASP.NET Core code skeleton
- ✅ Complete frontend UI (4 pages)
- ✅ ZIP download functionality

### Future Enhancements (v2)
- Zoom-in "More tests" feature using `source_chunks`
- Copy buttons for artifacts
- Individual artifact downloads
- WebSocket real-time updates
- Multi-user support with authentication

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── models/              # Pydantic schemas
│   │   ├── routes/              # API endpoints
│   │   └── services/
│   │       ├── brd_parser.py    # Document parsing
│   │       ├── llm_client.py    # Bedrock client
│   │       ├── job_manager.py   # State management
│   │       └── generation_pipeline.py
│   ├── generated/               # Output directory
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components
│   │   ├── pages/               # Route pages
│   │   ├── lib/                 # Utils & API client
│   │   └── types/               # TypeScript types
│   └── package.json
└── docs/
    └── PROJECT_SPEC.md          # Original specification
```

## 🔧 API Endpoints

- `GET /health` - Health check
- `POST /api/generate` - Start generation
- `GET /api/status/{job_id}` - Get status + results
- `GET /api/download/{job_id}` - Download ZIP

## 🧪 Testing

Upload a sample BRD (20-60 pages with sections and tables) to test the complete pipeline.

**Expected Processing Time**: 30-120 seconds depending on BRD size and complexity.

## ⚙️ Configuration

### Backend (.env)
```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_DEFAULT_REGION=us-east-1
PORT=8000
```

### File Limits
- Max upload size: **15MB**
- Supported formats: **.docx**, **.txt**

## 🐛 Troubleshooting

**Error: "Failed to parse JSON"**
- The LLM may have returned invalid JSON. The system retries once automatically.

**Error: "Job not found"**
- In-memory storage was cleared (server restart). Jobs are not persisted.

**Slow generation**
- Large BRDs (>50 pages) may take longer. Consider reducing content or sections.

## 📝 License

Built for hackathon demo purposes.
