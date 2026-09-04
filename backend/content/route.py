from fastapi import APIRouter, HTTPException, Depends
from typing import List
from .schemas import ContentModuleResponse, QuizSubmissionRequest
from db.content_library_db import get_all_modules, get_modules_with_progress, process_quiz_submission
from utils.jwt_auth import get_current_user

router = APIRouter()

@router.get("/modules", response_model=List[ContentModuleResponse])
async def fetch_modules(limit: int = 100, offset: int = 0, user_id: str = Depends(get_current_user)):
    try:
        modules = get_modules_with_progress(user_id, limit=limit, offset=offset)
        return modules
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch content modules: {str(e)}")

@router.post("/submit-quiz")
async def submit_quiz(request: QuizSubmissionRequest, user_id: str = Depends(get_current_user)):
    try:
        result = process_quiz_submission(user_id, request.module_id, request.score)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit quiz: {str(e)}")
