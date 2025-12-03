@echo off
REM SpecPilot Startup Script for Windows with Corporate Proxy Support

echo =====================================
echo   SpecPilot - Corporate Environment  
echo =====================================

REM Check if .env file exists
if not exist "backend\.env" (
    echo ERROR: backend\.env file not found!
    echo Please copy backend\.env.example to backend\.env and configure it
    echo Run: copy backend\.env.example backend\.env
    pause
    exit /b 1
)

REM Check if proxy is configured in .env
findstr /R "^HTTP_PROXY=" backend\.env >nul 2>&1
if %errorlevel%==0 (
    echo Proxy configured in .env
    echo.
    echo WARNING: Make sure your SPNEGO proxy is running!
    echo          ^(e.g., start-proxy.bat^)
    echo.
    pause
) else (
    echo No proxy configured in .env
)

REM Start backend
echo.
echo Starting backend server...
cd backend

REM Check if virtual environment exists
if not exist "venv\" (
    echo ERROR: Virtual environment not found. Please run setup first.
    pause
    exit /b 1
)

REM Activate virtual environment and start server
echo Starting FastAPI server on port 8000...
start "SpecPilot Backend" cmd /k "venv\Scripts\activate && python -c \"import dotenv\" 2>nul || pip install -r requirements.txt && venv\Scripts\uvicorn app.main:app --reload --port 8000"

cd ..

REM Start frontend
echo.
echo Starting frontend server...
cd frontend
start "SpecPilot Frontend" cmd /k "npm run dev"

cd ..

echo.
echo =====================================
echo   SpecPilot Started Successfully   
echo =====================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
echo Close the terminal windows to stop the servers
echo.
pause
