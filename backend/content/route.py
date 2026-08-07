from fastapi import APIRouter, HTTPException
from typing import List
from .schemas import ContentModuleResponse
from db.content_library_db import get_all_modules

router = APIRouter()

@router.get("/modules", response_model=List[ContentModuleResponse])
async def fetch_modules():
    try:
        modules = get_all_modules()
        return modules
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch content modules: {str(e)}")
