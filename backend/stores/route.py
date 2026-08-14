from fastapi import APIRouter, HTTPException, Depends
from utils.jwt_auth import get_current_user
from utils.supabase_client import supabase
from .schemas import StoresListResponse, StoreResponse

router = APIRouter()

@router.get("/", response_model=StoresListResponse)
async def get_all_stores(user_id: str = Depends(get_current_user)):
    try:
        response = supabase.table("stores").select("*").execute()
        
        stores = []
        for r in response.data:
            stores.append(StoreResponse(
                store_id=r.get("store_id"),
                store_name=r.get("store_name"),
                address=r.get("address"),
                city=r.get("city")
            ))
            
        return StoresListResponse(status="success", stores=stores)
    except Exception as e:
        print(f"Error fetching stores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
