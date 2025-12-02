# Project Generator - Backend API

FastAPI backend for the Project Generator application.

## Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure AWS Credentials

Copy `.env.example` to `.env` and add your AWS credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your AWS Bedrock credentials for `us-east-1` region.

### 3. Run the Server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

- `GET /health` - Health check
- `POST /api/generate` - Start generation pipeline
- `GET /api/status/{job_id}` - Get generation status
- `GET /api/download/{job_id}` - Download ZIP of generated artifacts

## Testing

Upload a BRD file (.docx or .txt) to test the pipeline.

## Directory Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── models/              # Pydantic models
│   ├── routes/              # API routes
│   └── services/            # Business logic
│       ├── brd_parser.py    # Document parsing
│       ├── llm_client.py    # AWS Bedrock client
│       ├── job_manager.py   # Job state management
│       └── generation_pipeline.py  # Pipeline orchestration
├── generated/               # Output directory for jobs
└── requirements.txt
```
