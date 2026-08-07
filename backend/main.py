from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.route import router as auth_router
from content.route import router as content_router

app = FastAPI(
    title="Reliance Project",
    description="Backend API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the auth router
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])

# Include the content router
app.include_router(content_router, prefix="/api/content", tags=["Content Library"])

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }

@app.get("/")
async def root():
    return {"message": "API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
