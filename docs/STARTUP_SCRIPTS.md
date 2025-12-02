# Startup Scripts Documentation

Convenient scripts to start SpecPilot backend and frontend servers.

---

## Available Scripts

### 1. `start-all.sh` / `start.bat` (Recommended)

**Purpose**: Start both backend and frontend in separate terminal windows with one command.

**Usage**:
```bash
# macOS/Linux
./start-all.sh

# Windows
start.bat
```

**What it does**:
- Detects your operating system (macOS, Linux, Windows)
- Opens a new terminal window for backend server
- Opens a new terminal window for frontend server
- Provides URLs for accessing the application

**Platform Support**:
- ✅ macOS (Terminal)
- ✅ Linux (gnome-terminal, xterm)
- ✅ Windows (Command Prompt)

---

### 2. `start-backend.sh`

**Purpose**: Start only the FastAPI backend server.

**Usage**:
```bash
./start-backend.sh
```

**Features**:
- ✅ Checks if virtual environment exists
- ✅ Validates AWS credentials
- ✅ Activates virtual environment automatically
- ✅ Installs dependencies if missing
- ✅ Starts server with hot-reload on port 8000

**URLs**:
- Backend API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

**Error Handling**:
- Warns if AWS credentials not configured
- Prompts to continue or abort
- Checks for required dependencies

---

### 3. `start-frontend.sh`

**Purpose**: Start only the React frontend development server.

**Usage**:
```bash
./start-frontend.sh
```

**Features**:
- ✅ Checks if node_modules exists
- ✅ Verifies backend is running
- ✅ Starts Vite dev server on port 5173

**URLs**:
- Frontend UI: `http://localhost:5173`

**Error Handling**:
- Warns if backend not responding
- Prompts to continue or abort
- Checks for required dependencies

---

## First-Time Setup

Before using the startup scripts, complete the initial setup:

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
npm install
```

### AWS Configuration
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your Secret Access Key
# Default region: us-east-1
```

---

## Usage Examples

### Example 1: Quick Start for Development

```bash
# Start everything at once
./start-all.sh

# Access the application
# Frontend: http://localhost:5173
# Backend: http://localhost:8000/docs
```

### Example 2: Start Services Separately

```bash
# Terminal 1: Start backend
./start-backend.sh

# Terminal 2: Start frontend (in a new terminal)
./start-frontend.sh
```

### Example 3: Troubleshooting

```bash
# Test backend only
./start-backend.sh

# In another terminal, check health
curl http://localhost:8000/health

# If working, start frontend
./start-frontend.sh
```

---

## Troubleshooting

### Script Permission Denied

**Error**: `Permission denied: ./start-backend.sh`

**Solution**:
```bash
chmod +x start-backend.sh start-frontend.sh start-all.sh
```

### Virtual Environment Not Found

**Error**: `Virtual environment not found`

**Solution**:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### AWS Credentials Not Configured

**Error**: `AWS credentials not configured or invalid`

**Solution**:
```bash
aws configure
# Follow prompts to enter credentials
```

### Backend Not Responding

**Error**: `Backend server not responding`

**Solution**:
1. Check if port 8000 is already in use:
   ```bash
   lsof -i :8000  # macOS/Linux
   netstat -ano | findstr :8000  # Windows
   ```
2. Kill existing process or change port
3. Restart backend

### Port Already in Use

**Error**: `Address already in use: ('0.0.0.0', 8000)`

**Solution**:
```bash
# Find and kill process using port 8000
# macOS/Linux
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <process_id> /F
```

---

## Script Validation Checks

### Backend Script Checks
1. ✅ Verify backend directory exists
2. ✅ Check virtual environment exists
3. ✅ Validate AWS credentials
4. ✅ Activate virtual environment
5. ✅ Verify dependencies installed
6. ✅ Start uvicorn server

### Frontend Script Checks
1. ✅ Verify frontend directory exists
2. ✅ Check node_modules exists
3. ✅ Verify backend is running
4. ✅ Start Vite dev server

### Start-All Script Checks
1. ✅ Detect operating system
2. ✅ Make scripts executable
3. ✅ Open backend in new terminal
4. ✅ Wait for backend initialization
5. ✅ Open frontend in new terminal
6. ✅ Display access URLs

---

## Platform-Specific Notes

### macOS
- Uses AppleScript to open Terminal windows
- Requires Terminal.app (default on macOS)
- Scripts run with bash

### Linux
- Tries gnome-terminal first (Ubuntu/GNOME)
- Falls back to xterm if gnome-terminal unavailable
- May require installing terminal emulator

### Windows
- Uses Command Prompt (cmd)
- `.bat` file for Windows compatibility
- Git Bash supported for `.sh` scripts

---

## Advanced Usage

### Custom Ports

**Backend Custom Port**:
```bash
# Edit start-backend.sh, line ~50
./venv/bin/uvicorn app.main:app --reload --port 8080
```

**Frontend Custom Port**:
```bash
# Edit frontend/vite.config.ts
export default defineConfig({
  server: {
    port: 3000
  }
})
```

### Production Mode

**Note**: These scripts are for **development only**.

For production deployment:
- Use gunicorn/uvicorn workers
- Configure NGINX reverse proxy
- Use environment variables for configuration
- Enable HTTPS
- Set up monitoring and logging

---

## Script Maintenance

### Updating Scripts

1. Make changes to script files
2. Test on your platform
3. Update documentation if behavior changes
4. Commit changes to git

### Adding New Platforms

To add support for a new terminal emulator:
1. Edit `start-all.sh`
2. Add detection for new terminal
3. Add command to open new terminal window
4. Test thoroughly

---

## Quick Reference

| Script | Platform | Purpose |
|--------|----------|---------|
| `start-all.sh` | macOS/Linux | Start both servers |
| `start.bat` | Windows | Start both servers |
| `start-backend.sh` | macOS/Linux | Backend only |
| `start-frontend.sh` | macOS/Linux | Frontend only |

---

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development setup guide
- [API.md](API.md) - API endpoint reference
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture

---

**Need help?** Open an issue on GitHub or check the troubleshooting section above.
