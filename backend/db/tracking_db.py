from utils.supabase_client import supabase
from typing import List, Dict, Any

def persist_worker_locations(locations_to_persist: List[Dict[str, Any]]) -> None:
    """
    Upserts the latest worker locations and appends to the history table.
    """
    if not locations_to_persist:
        return
        
    # Upsert the current hot locations
    supabase.table("worker_current_locations").upsert(
        locations_to_persist, on_conflict="worker_id"
    ).execute()
    
    # Append to historical tracking table
    supabase.table("worker_location_history").insert(
        locations_to_persist
    ).execute()
