@echo off
REM SpecPilot Complete Startup Script for Corporate Proxy Environment
REM Starts backend with proxy settings and frontend in separate windows

echo.
echo ========================================
echo   SpecPilot - Starting All Services
echo ========================================
echo.

REM Check if .env file exists
if not exist "backend\.env" (
    echo ERROR: backend\.env file not found!
    echo.
    echo Please create backend\.env from backend\.env.example
    pause
    exit /b 1
)

REM Start backend in new window
echo Starting backend with proxy settings...
start "SpecPilot Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && set HTTP_PROXY=http://127.0.0.1:8888 && set HTTPS_PROXY=http://127.0.0.1:8888 && set http_proxy=http://127.0.0.1:8888 && set https_proxy=http://127.0.0.1:8888 && echo Backend starting with proxy configuration... && python -m uvicorn app.main:app --reload --port 8000"

REM Wait for backend to start
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

REM Start frontend in new window
echo Starting frontend...
start "SpecPilot Frontend" cmd /k "cd /d %~dp0frontend && echo Frontend starting... && npm run dev"

echo.
echo ========================================
echo   SpecPilot Services Started
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
echo Press any key to exit this window...
pause >nul
