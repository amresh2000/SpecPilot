@echo off
REM SpecPilot Backend Startup Script for Corporate Proxy Environment
REM This script sets environment variables before starting Python

echo.
echo ========================================
echo   SpecPilot Backend with Proxy Support
echo ========================================
echo.

REM Check if .env file exists
if not exist "backend\.env" (
    echo ERROR: backend\.env file not found!
    echo.
    echo Please create backend\.env from backend\.env.example:
    echo   1. Copy backend\.env.example to backend\.env
    echo   2. Edit backend\.env with your AWS credentials
    echo   3. Uncomment proxy settings if using corporate proxy
    echo.
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "backend\venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo.
    echo Please run: cd backend ^&^& python -m venv venv ^&^& venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo Checking SPNEGO proxy status...
netstat -ano | findstr :8888 >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: SPNEGO proxy does not appear to be running on port 8888
    echo If you need proxy support, please start your proxy first:
    echo   start-proxy.bat
    echo.
    echo Press any key to continue anyway, or Ctrl+C to abort...
    pause >nul
)

REM Load environment variables from .env file
echo Loading configuration from backend\.env...
for /f "usebackq tokens=1,* delims==" %%a in ("backend\.env") do (
    set "line=%%a"
    REM Skip comments and empty lines
    if not "!line:~0,1!"=="#" if not "%%a"=="" (
        set "%%a=%%b"
    )
)

REM Explicitly set proxy environment variables for boto3
if defined HTTP_PROXY (
    echo Proxy configured: %HTTP_PROXY%
    set "http_proxy=%HTTP_PROXY%"
    set "https_proxy=%HTTPS_PROXY%"
    set "no_proxy=%NO_PROXY%"
)

echo.
echo Starting SpecPilot Backend...
echo Configuration:
echo   AWS Region: %AWS_REGION%
if defined HTTP_PROXY echo   Proxy: %HTTP_PROXY%
echo   Port: 8000
echo.
echo Backend will be available at: http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.

REM Activate virtual environment and start server
cd backend
call venv\Scripts\activate.bat
python -m uvicorn app.main:app --reload --port 8000

pause
