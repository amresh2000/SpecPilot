#!/bin/bash

# SpecPilot Complete Startup Script
# This script starts both backend and frontend in separate terminal windows

set -e  # Exit on error

echo "🚀 Starting SpecPilot (Backend + Frontend)..."
echo ""

# Check if we're in the project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: backend or frontend directory not found"
    echo "Please run this script from the SpecPilot project root"
    exit 1
fi

# Make scripts executable
chmod +x start-backend.sh
chmod +x start-frontend.sh

# Detect OS and open terminals accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS - Opening Terminal windows..."

    # Start backend in new Terminal window
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && ./start-backend.sh"'

    # Wait a moment for backend to start
    sleep 3

    # Start frontend in new Terminal window
    osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && ./start-frontend.sh"'

    echo "✅ Backend and Frontend starting in separate Terminal windows"
    echo ""
    echo "🌐 Backend API: http://localhost:8000"
    echo "🌐 Frontend UI: http://localhost:5173"
    echo ""
    echo "To stop servers, close the Terminal windows or press Ctrl+C in each"

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux - Opening terminal windows..."

    # Try gnome-terminal (Ubuntu/GNOME)
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd $(pwd) && ./start-backend.sh; exec bash"
        sleep 3
        gnome-terminal -- bash -c "cd $(pwd) && ./start-frontend.sh; exec bash"
    # Try xterm (fallback)
    elif command -v xterm &> /dev/null; then
        xterm -e "cd $(pwd) && ./start-backend.sh" &
        sleep 3
        xterm -e "cd $(pwd) && ./start-frontend.sh" &
    else
        echo "⚠️  No supported terminal emulator found"
        echo "Please run manually:"
        echo "  Terminal 1: ./start-backend.sh"
        echo "  Terminal 2: ./start-frontend.sh"
        exit 1
    fi

    echo "✅ Backend and Frontend starting in separate terminal windows"

elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows (Git Bash/MSYS)
    echo "🪟 Detected Windows - Opening Command Prompt windows..."

    # Start backend
    start cmd /k "cd /d %cd% && bash start-backend.sh"
    sleep 3

    # Start frontend
    start cmd /k "cd /d %cd% && bash start-frontend.sh"

    echo "✅ Backend and Frontend starting in separate Command Prompt windows"

else
    echo "⚠️  Unsupported OS: $OSTYPE"
    echo "Please run manually:"
    echo "  Terminal 1: ./start-backend.sh"
    echo "  Terminal 2: ./start-frontend.sh"
    exit 1
fi

echo ""
echo "🎉 SpecPilot is starting!"
echo ""
echo "📖 Documentation: docs/"
echo "📝 API Reference: http://localhost:8000/docs"
echo ""
