# Corporate Environment Setup Guide

This guide explains how to use SpecPilot in a corporate environment with SPNEGO proxy and SSO authentication.

## Quick Start

### 1. Setup Environment Variables

```bash
# Copy the example configuration
cp backend/.env.example backend/.env

# Edit backend/.env with your settings
nano backend/.env
```

### 2. Configure for Corporate Proxy

Edit `backend/.env`:

```bash
# AWS Bedrock Configuration (REQUIRED)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here

# Corporate Proxy Configuration
HTTP_PROXY=http://127.0.0.1:8888
HTTPS_PROXY=http://127.0.0.1:8888
NO_PROXY=localhost,127.0.0.1
```

### 3. Start Your Proxy

Before starting SpecPilot, ensure your SPNEGO proxy is running:

**Windows**:
```batch
start-proxy.bat
```

This typically starts a proxy on `127.0.0.1:8888`.

### 4. Start SpecPilot

**Windows**:
```batch
start-with-proxy.bat
```

**Mac/Linux**:
```bash
./start-with-proxy.sh
```

## How It Works

### Proxy Flow

```
SpecPilot Backend
    ↓ (reads .env)
    ↓ Sets HTTP_PROXY=127.0.0.1:8888
    ↓
SPNEGO Proxy (127.0.0.1:8888)
    ↓ (handles Kerberos/NTLM auth)
    ↓
Corporate Network Gateway
    ↓
    └─→ AWS Bedrock (for LLM calls)
```

### Automatic Proxy Support

Both `boto3` (AWS SDK) and `requests` (HTTP library) automatically respect the `HTTP_PROXY` and `HTTPS_PROXY` environment variables. No code changes needed!

## Troubleshooting

### Issue: Configuration Validation Fails

**Error**: `Configuration errors: ['AWS_ACCESS_KEY_ID is required']`

**Solution**: 
1. Check that `backend/.env` file exists
2. Ensure AWS credentials are set in `.env`
3. Restart the backend server

### Issue: Connection to AWS Bedrock Fails

**Error**: `Connection timeout` or `Connection refused`

**Solution**:
1. Verify SPNEGO proxy is running: `curl http://127.0.0.1:8888`
2. Check proxy configuration in `.env`
3. Ensure proxy has internet access

### Issue: SSL Certificate Errors

**Error**: `SSL: CERTIFICATE_VERIFY_FAILED`

**Solution**: Add corporate CA bundle to `.env`:
```bash
REQUESTS_CA_BUNDLE=/path/to/corporate-ca-bundle.crt
```

Or temporarily disable verification (not recommended for production):
```bash
SSL_VERIFY=false
```

## Security Considerations

- ✅ **Never commit `.env` file** - it contains credentials
- ✅ **Never commit AWS credentials** to version control
- ✅ **Rotate API tokens** every 90 days
- ✅ **Use service accounts** for production integrations
- ✅ **Enable audit logging** for compliance

## Additional Resources

- AWS Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- Boto3 Proxy Configuration: https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html
- SPNEGO Proxy Setup: Contact your IT department

## Support

For corporate environment issues, contact your IT department or system administrator.
