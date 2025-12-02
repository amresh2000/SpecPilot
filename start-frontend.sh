#!/bin/bash

# SpecPilot Frontend Startup Script
# This script starts the React development server

set -e  # Exit on error

echo "🚀 Starting SpecPilot Frontend..."
echo ""

# Check if we're in the project root
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    echo "Please run this script from the SpecPilot project root"
    exit 1
fi

# Navigate to frontend directory
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Error: node_modules not found"
    echo "Please run the following commands first:"
    echo "  cd frontend"
    echo "  npm install"
    exit 1
fi

# Check if backend is running
if ! curl -s http://localhost:8000/health &> /dev/null; then
    echo "⚠️  Warning: Backend server not responding at http://localhost:8000"
    echo "Please start the backend first using: ./start-backend.sh"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start the development server
echo "✅ Starting Vite development server"
echo "🌐 Frontend will be available at http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
