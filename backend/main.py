import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.route import router as auth_router
from content.route import router as content_router
from jobs.route import router as jobs_router
from stores.route import router as stores_router
from superadmin.route import router as superadmin_router
from finance.route import router as finance_router

from apscheduler.schedulers.background import BackgroundScheduler
from jobs.cron_tasks import check_t90_voice_calls

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from utils.limiter import limiter

app = FastAPI(
    title="Reliance Project",
    description="Backend API",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

import time
import asyncio
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse
from utils.logger import log_error_to_supabase

from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    # Log 4xx/5xx to Supabase if desired, or let middleware handle the generic log
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_type": "HTTPException",
            "message": exc.detail,
            "path": request.url.path
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error_type": "ValidationError",
            "message": "Invalid request parameters",
            "details": exc.errors(),
            "path": request.url.path
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_detail = f"{str(exc)}\n{traceback.format_exc()}"
    print(f"[CRITICAL 500] {request.method} {request.url.path}: {error_detail}")
    
    # Log the crash to Supabase asynchronously
    asyncio.create_task(log_error_to_supabase(
        request=request, 
        status_code=500, 
        error_message=str(exc)
    ))
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_type": "InternalServerError",
            "message": "An unexpected error occurred. The incident has been logged.",
            "path": request.url.path
        }
    )

@app.middleware("http")
async def log_requests_and_errors(request: Request, call_next):
    start_time = time.time()
    
    # Execute request
    response = await call_next(request)
    process_time = time.time() - start_time
    
    if request.url.path.startswith("/api/tracking"):
        print(f"[Observability] {request.method} {request.url.path} - Status {response.status_code} - {process_time*1000:.2f}ms")
        
    # Log non-500 HTTP errors to Supabase (500s are handled by the global exception handler)
    if 400 <= response.status_code < 500:
        asyncio.create_task(log_error_to_supabase(
            request=request, 
            status_code=response.status_code, 
            error_message=f"HTTP Error {response.status_code}"
        ))
        
    return response

scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    # scheduler.add_job(check_t60_status, 'interval', minutes=3)
    scheduler.add_job(check_t90_voice_calls, 'interval', minutes=2)
    scheduler.start()
    print("[System] Background scheduler started T-90 Voice Worker every 2 mins")
    
    # Start ETA Worker
    from tracking.eta_worker import process_eta_queue
    import asyncio
    app.state.eta_task = asyncio.create_task(process_eta_queue())
    
    # Start Persistence Worker
    from tracking.persistence_worker import process_persistence
    app.state.persistence_task = asyncio.create_task(process_persistence())

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
    print("[System] Background scheduler stopped")


# Configure CORS
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:3000,http://localhost:8081"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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

# Include the finance router
app.include_router(finance_router, prefix="/api/finance", tags=["Finance"])

from tracking.route import router as tracking_router
from tracking.websocket import router as tracking_ws_router

# Include the tracking routers
app.include_router(tracking_router, prefix="/api/tracking", tags=["Tracking"])
app.include_router(tracking_ws_router, tags=["Tracking WebSockets"])

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
