# Corporate Proxy Troubleshooting Guide

Complete guide for resolving DNS and connectivity issues when using SpecPilot with corporate SPNEGO proxy.

## ✅ What We Know Works

Your `curl` test succeeded, which confirms:
- ✅ SPNEGO proxy is running correctly on 127.0.0.1:8888
- ✅ Proxy can forward requests to AWS Bedrock endpoints
- ✅ DNS resolution through proxy works
- ✅ Corporate network allows AWS traffic through proxy

## 🔧 Setup Steps (In Order)

### Step 1: Start SPNEGO Proxy FIRST

```cmd
REM Always start proxy before SpecPilot
start-proxy.bat

REM Verify proxy is running
netstat -ano | findstr :8888
```

You should see output like:
```
TCP    127.0.0.1:8888    0.0.0.0:0    LISTENING    12345
```

### Step 2: Configure `.env` File

Create `backend\.env` from template:

```cmd
copy backend\.env.example backend\.env
notepad backend\.env
```

**Required Configuration**:

```bash
# AWS Credentials (REQUIRED)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-actual-access-key
AWS_SECRET_ACCESS_KEY=your-actual-secret-key

# Proxy Configuration (REQUIRED for corporate network)
# IMPORTANT: Remove the # to uncomment these lines
HTTP_PROXY=http://127.0.0.1:8888
HTTPS_PROXY=http://127.0.0.1:8888
NO_PROXY=localhost,127.0.0.1

# Application Settings
PORT=8000
```

**Common Mistake**: Leaving proxy lines commented out with `#`

### Step 3: Start SpecPilot Backend

**Option A: Use Startup Script (Recommended)**

```cmd
start-backend-proxy.bat
```

This script:
- Checks if proxy is running
- Loads environment variables correctly
- Sets both uppercase and lowercase proxy env vars (boto3 needs this)
- Provides helpful diagnostics

**Option B: Manual Start**

```cmd
cd backend
venv\Scripts\activate
set HTTP_PROXY=http://127.0.0.1:8888
set HTTPS_PROXY=http://127.0.0.1:8888
set http_proxy=http://127.0.0.1:8888
set https_proxy=http://127.0.0.1:8888
python -m uvicorn app.main:app --reload --port 8000
```

**Note**: Both uppercase and lowercase are needed because:
- Windows uses uppercase environment variables
- Boto3/Python libraries check lowercase first

### Step 4: Verify Startup Logs

Look for these messages in the backend startup:

```
✓ Configuration validated successfully
✓ Using proxy: http://127.0.0.1:8888
Boto3 using explicit proxy: http://127.0.0.1:8888
```

If you DON'T see these messages, the proxy configuration didn't load correctly.

## 🐛 Common Errors and Fixes

### Error 1: "DNS name does not exist"

**Cause**: Boto3 cannot resolve AWS endpoint DNS names

**Fixes**:

1. **Check proxy is running**:
   ```cmd
   netstat -ano | findstr :8888
   ```

2. **Verify .env has proxy uncommented**:
   ```cmd
   type backend\.env | findstr PROXY
   ```
   Should show:
   ```
   HTTP_PROXY=http://127.0.0.1:8888
   HTTPS_PROXY=http://127.0.0.1:8888
   ```
   NOT:
   ```
   # HTTP_PROXY=http://127.0.0.1:8888
   ```

3. **Use the new startup script** which sets env vars correctly:
   ```cmd
   start-backend-proxy.bat
   ```

### Error 2: "Could not connect to the endpoint URL"

**Cause**: Request is not going through proxy

**Fixes**:

1. **Restart backend after proxy starts**:
   ```cmd
   REM Start proxy first
   start-proxy.bat

   REM Wait 5 seconds
   timeout /t 5

   REM Then start backend
   start-backend-proxy.bat
   ```

2. **Check environment variables are set**:
   ```cmd
   cd backend
   venv\Scripts\activate
   python -c "import os; print(f'HTTP_PROXY: {os.getenv(\"HTTP_PROXY\")}'); print(f'http_proxy: {os.getenv(\"http_proxy\")}')"
   ```

### Error 3: "Connection reset by peer" or "Connection refused"

**Cause**: Proxy configuration issue

**Fixes**:

1. **Test proxy with curl** (like you did):
   ```cmd
   curl -x http://127.0.0.1:8888 https://bedrock-runtime.us-east-1.amazonaws.com
   ```

   Should get `UnknownOperationException` (this is GOOD - means proxy works)

2. **Check proxy logs** for SpecPilot requests - you should see similar "forward start/done" messages

3. **Try with explicit endpoint** - add to `.env`:
   ```bash
   AWS_BEDROCK_ENDPOINT=https://bedrock-runtime.us-east-1.amazonaws.com
   ```

### Error 4: SSL Certificate Errors

**Cause**: Corporate SSL inspection

**Fixes**:

Add to `.env`:

```bash
# Option 1: Use corporate CA bundle (recommended)
REQUESTS_CA_BUNDLE=C:\path\to\corporate-ca-bundle.crt

# Option 2: Disable SSL verification (NOT recommended for production)
SSL_VERIFY=false
```

## 📋 Diagnostic Checklist

Run these checks in order:

```cmd
REM 1. Proxy running?
netstat -ano | findstr :8888

REM 2. .env file exists?
dir backend\.env

REM 3. Proxy settings in .env?
type backend\.env | findstr PROXY

REM 4. Test proxy with curl
curl -x http://127.0.0.1:8888 https://bedrock-runtime.us-east-1.amazonaws.com

REM 5. Start backend and check logs
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

## 🎯 Expected Startup Sequence

**Correct Order**:

1. Start SPNEGO proxy → `start-proxy.bat`
2. Verify proxy running → `netstat -ano | findstr :8888`
3. Start backend → `start-backend-proxy.bat`
4. Check logs for proxy confirmation
5. Start frontend → `cd frontend && npm run dev`
6. Test application → Upload BRD

**Wrong Order** (Will Fail):

1. ❌ Start backend before proxy
2. ❌ Start backend without proxy running
3. ❌ Use old startup scripts without proxy env vars

## 🔍 Testing Connection

After starting the backend, test the connection:

### Test 1: Health Check

```cmd
curl http://localhost:8000/health
```

Expected: `{"status":"healthy"}`

### Test 2: Upload Test Document

Use the UI at `http://localhost:5173` to upload a small test BRD.

Watch backend logs for:
```
Boto3 using explicit proxy: http://127.0.0.1:8888
```

Watch proxy logs for:
```
[timestamp] Forward start: bedrock-runtime.us-east-1.amazonaws.com
[timestamp] Done inbound/outbound
```

## 📞 Still Having Issues?

Provide these details for further troubleshooting:

1. **Exact error message** from backend logs
2. **Proxy logs** during the failed request
3. **Startup logs** showing configuration
4. **Environment check**:
   ```cmd
   cd backend
   venv\Scripts\activate
   python -c "import os; from app.config import config; print(f'Region: {config.AWS_REGION}'); print(f'Proxy: {config.HTTP_PROXY}'); print(f'Access Key: {config.AWS_ACCESS_KEY_ID[:10]}...')"
   ```

## 🎓 Understanding the Fix

The changes made to SpecPilot:

1. **Explicit proxy configuration in boto3**: Instead of relying on environment variables alone, boto3 now receives explicit `proxies` parameter
2. **Startup script**: Sets both uppercase and lowercase env vars (Windows vs Python libraries)
3. **Validation logging**: Shows when proxy is being used
4. **Environment loading**: `.env` file loaded with proper precedence

This ensures boto3 ALWAYS uses the proxy when configured, regardless of environment variable quirks.
