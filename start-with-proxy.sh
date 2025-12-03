#!/bin/bash

# SpecPilot Startup Script with Corporate Proxy Support
# For environments using SPNEGO proxy or other corporate proxies

set -e

echo "====================================="
echo "  SpecPilot - Corporate Environment  "
echo "====================================="

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env file not found!"
    echo "Please copy backend/.env.example to backend/.env and configure it"
    echo "Run: cp backend/.env.example backend/.env"
    exit 1
fi

# Check if proxy is configured in .env
if grep -q "^HTTP_PROXY=" backend/.env 2>/dev/null; then
    PROXY_URL=$(grep "^HTTP_PROXY=" backend/.env | cut -d '=' -f2)
    echo "✓ Proxy configured: $PROXY_URL"
    echo ""
    echo "⚠️  Make sure your SPNEGO proxy is running!"
    echo "   (e.g., start-proxy.bat on Windows)"
    echo ""
    read -p "Press Enter to continue once proxy is running..."
else
    echo "ℹ️  No proxy configured in .env"
fi

# Start backend
echo ""
echo "Starting backend server..."
cd backend

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ Virtual environment not found. Please run setup first."
    exit 1
fi

# Install dependencies if needed
if ! python -c "import dotenv" 2>/dev/null; then
    echo "Installing python-dotenv..."
    pip install -r requirements.txt
fi

# Start backend server
echo "✓ Starting FastAPI server on port 8000..."
./venv/bin/uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

cd ..

# Start frontend
echo ""
echo "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "====================================="
echo "  ✓ SpecPilot Started Successfully   "
echo "====================================="
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for user interrupt
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT
wait
