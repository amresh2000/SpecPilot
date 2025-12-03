from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import generation
from app.config import config

# Load and validate configuration at startup
try:
    config.validate()
    print("✓ Configuration validated successfully")
    if config.HTTP_PROXY:
        print(f"✓ Using proxy: {config.HTTP_PROXY}")
except ValueError as e:
    print(f"✗ Configuration error: {e}")
    print("Please check your .env file and ensure all required variables are set")
    raise

app = FastAPI(title="Project Generator API", version="1.0.0")

# CORS configuration for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(generation.router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
