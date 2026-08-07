from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from .schemas import ContentModuleResponse, QuizSubmissionRequest
from db.content_library_db import get_all_modules, get_modules_with_progress, process_quiz_submission

router = APIRouter()

@router.get("/modules", response_model=List[ContentModuleResponse])
async def fetch_modules(user_id: Optional[str] = Query(None)):
    try:
        if user_id:
            modules = get_modules_with_progress(user_id)
        else:
            modules = get_all_modules()
        return modules
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch content modules: {str(e)}")

@router.post("/submit-quiz")
async def submit_quiz(request: QuizSubmissionRequest):
    try:
        result = process_quiz_submission(request.user_id, request.module_id, request.score)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit quiz: {str(e)}")
