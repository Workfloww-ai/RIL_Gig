from pydantic import BaseModel
from typing import Optional, List

class StoreResponse(BaseModel):
    store_id: str
    store_name: str
    address: Optional[str] = None
    city: Optional[str] = None

class StoresListResponse(BaseModel):
    status: str
    stores: List[StoreResponse]
