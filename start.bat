@echo off
REM SpecPilot Windows Startup Script
REM This script starts both backend and frontend

echo Starting SpecPilot (Backend + Frontend)...
echo.

REM Check if directories exist
if not exist "backend" (
    echo Error: backend directory not found
    echo Please run this script from the SpecPilot project root
    pause
    exit /b 1
)

if not exist "frontend" (
    echo Error: frontend directory not found
    echo Please run this script from the SpecPilot project root
    pause
    exit /b 1
)

REM Start backend in new window
echo Starting Backend...
start "SpecPilot Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

REM Wait for backend to initialize
timeout /t 3 /nobreak > nul

REM Start frontend in new window
echo Starting Frontend...
start "SpecPilot Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo SpecPilot is starting!
echo.
echo Backend API: http://localhost:8000
echo Frontend UI: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
echo To stop servers, close the command prompt windows
echo.
pause
