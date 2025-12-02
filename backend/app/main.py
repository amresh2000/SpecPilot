from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import generation

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
