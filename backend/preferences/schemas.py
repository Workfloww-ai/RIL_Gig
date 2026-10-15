from pydantic import BaseModel
from typing import List, Optional

class CategoryItem(BaseModel):
    category_id: str
    name: str
    domain_id: str

class DomainWithCategories(BaseModel):
    domain_id: str
    name: str
    categories: List[CategoryItem]

class TaxonomyResponse(BaseModel):
    status: str = "success"
    domains: List[DomainWithCategories]

class CategoryInfo(BaseModel):
    category_id: str
    name: str
    domain_id: Optional[str] = None
    domain_name: Optional[str] = None

class DomainInfo(BaseModel):
    domain_id: str
    name: str

class UserPreferencesResponse(BaseModel):
    status: str = "success"
    selected_category_ids: List[str]
    certified_category_ids: List[str]
    categories: Optional[List[CategoryInfo]] = None
    certified_categories: Optional[List[CategoryInfo]] = None
    domain: Optional[DomainInfo] = None

class SavePreferencesRequest(BaseModel):
    category_ids: List[str]

class ActionResponse(BaseModel):
    status: str
    message: str
