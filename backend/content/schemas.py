from pydantic import BaseModel
from typing import List, Optional, Any

class ContentModuleResponse(BaseModel):
    id: str
    title: str
    category_name: str
    duration_text: Optional[str] = None
    video_url: Optional[str] = None
    podcast_url: Optional[str] = None
    overview_text: Optional[str] = None
    quiz_questions: Optional[List[Any]] = []
    key_module_topics: Optional[List[str]] = []
    order_index: int
    is_locked_default: bool
    status: Optional[str] = "locked"
    highest_quiz_score: Optional[int] = 0
    completed_at: Optional[str] = None

class QuizSubmissionRequest(BaseModel):
    module_id: str
    score: int
