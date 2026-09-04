from utils.supabase_client import supabase

def mark_user_verified(user_id: str) -> bool:
    """
    Marks a user as verified in the database upon their first login.
    Returns True if successful, False otherwise.
    """
    try:
        res = supabase.table("users").update({"is_verified": True}).eq("user_id", user_id).execute()
        if res.data:
            return True
        return False
    except Exception as e:
        print(f"Error marking user {user_id} as verified: {e}")
        return False
