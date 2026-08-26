from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.route import router as auth_router
from content.route import router as content_router
from jobs.route import router as jobs_router
from stores.route import router as stores_router
from superadmin.route import router as superadmin_router

# from apscheduler.schedulers.background import BackgroundScheduler
# from jobs.cron_tasks import check_t60_status

app = FastAPI(
    title="Reliance Project",
    description="Backend API",
    version="1.0.0"
)

# scheduler = BackgroundScheduler()

# @app.on_event("startup")
# def start_scheduler():
#     scheduler.add_job(check_t60_status, 'interval', minutes=3)
#     scheduler.start()
#     print("[System] Background scheduler started (running every 1 min)")

# @app.on_event("shutdown")
# def shutdown_scheduler():
#     scheduler.shutdown()
#     print("[System] Background scheduler stopped")

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

# Include the jobs router
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])

# Include the stores router
app.include_router(stores_router, prefix="/api/stores", tags=["Stores"])

# Include the superadmin router
app.include_router(superadmin_router, prefix="/api/superadmin", tags=["Superadmin"])

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
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
