from utils.supabase_client import supabase

def get_all_modules():
    """
    Fetches all modules from the content_library table.
    Explicitly selects columns to avoid SELECT * per enterprise rules.
    Orders them by order_index.
    """
    response = supabase.table("content_library").select(
        "id, title, category_name, duration_text, video_url, podcast_url, overview_text, quiz_questions, key_module_topics, order_index, is_locked_default"
    ).order("order_index").execute()
    
    return response.data
