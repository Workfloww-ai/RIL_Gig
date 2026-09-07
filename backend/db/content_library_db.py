from utils.supabase_client import supabase

def initialize_user_progress_if_needed(user_id: str):
    """
    Checks if a user has progress rows. If not, initializes them based on content_library.
    First module (order_index=1) is in_progress, rest are locked.
    """
    # Check if user already has progress
    progress_check = supabase.table("user_module_progress").select("id").eq("user_id", user_id).limit(1).execute()
    if len(progress_check.data) > 0:
        return # Already initialized
        
    # Get all modules
    modules = get_all_modules()
    if not modules:
        return
        
    # Prepare rows to insert
    progress_rows = []
    for module in modules:
        # Module 1 starts as 'in_progress', others 'locked'
        status = 'in_progress' if module['order_index'] == 1 else 'locked'
        progress_rows.append({
            "user_id": user_id,
            "module_id": module['id'],
            "status": status
        })
        
    # Insert all rows
    if progress_rows:
        supabase.table("user_module_progress").insert(progress_rows).execute()

def get_modules_with_progress(user_id: str, limit: int = 100, offset: int = 0):
    """
    Fetches all modules and joins with the user's progress.
    """
    # Ensure progress rows exist
    initialize_user_progress_if_needed(user_id)
    
    # Fetch all modules
    modules = get_all_modules(limit=limit, offset=offset)
    
    # Fetch user progress
    progress = supabase.table("user_module_progress").select("module_id, status, highest_quiz_score, completed_at").eq("user_id", user_id).execute()
    progress_dict = {p['module_id']: p for p in progress.data}
    
    # Merge
    merged = []
    for mod in modules:
        mod_prog = progress_dict.get(mod['id'])
        # Override is_locked_default with actual user progress
        mod['status'] = mod_prog['status'] if mod_prog else 'locked'
        mod['highest_quiz_score'] = mod_prog['highest_quiz_score'] if mod_prog else 0
        mod['completed_at'] = mod_prog.get('completed_at') if mod_prog else None
        merged.append(mod)
        
    return merged

def process_quiz_submission(user_id: str, module_id: str, score: int, passing_score: int = 80):
    """
    Saves the quiz score. If passed, unlocks the next module.
    """
    # Get current progress for this module
    curr_prog = supabase.table("user_module_progress").select("id, status, highest_quiz_score").eq("user_id", user_id).eq("module_id", module_id).execute()
    if not curr_prog.data:
        raise Exception("Module progress not found")
        
    prog = curr_prog.data[0]
    
    # Update highest score (handle NULL from database)
    current_highest = prog.get('highest_quiz_score')
    if current_highest is None:
        current_highest = 0
    new_highest = max(score, current_highest)
    
    # Determine new status
    new_status = prog['status']
    passed = score >= passing_score
    if passed:
        new_status = 'quiz_passed'
        
    # Save progress
    update_data = {
        "highest_quiz_score": new_highest,
        "status": new_status
    }
    
    if passed and prog['status'] != 'quiz_passed':
        # Only set completed_at the FIRST time they pass
        from datetime import datetime, timezone
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
    supabase.table("user_module_progress").update(update_data).eq("id", prog['id']).execute()
    
    # If they passed, unlock the next module
    if passed:
        # Get the current module's order_index
        curr_module = supabase.table("content_library").select("order_index").eq("id", module_id).single().execute()
        
        # Find next module
        next_module = supabase.table("content_library").select("id").eq("order_index", curr_module.data['order_index'] + 1).execute()
        
        if next_module.data:
            next_mod_id = next_module.data[0]['id']
            # Only unlock if it's currently locked (don't downgrade if already passed)
            next_prog = supabase.table("user_module_progress").select("id, status").eq("user_id", user_id).eq("module_id", next_mod_id).single().execute()
            
            if next_prog.data and next_prog.data['status'] == 'locked':
                supabase.table("user_module_progress").update({"status": "in_progress"}).eq("id", next_prog.data['id']).execute()
                
    return {"success": True, "passed": passed, "score": score}

def get_all_modules(limit: int = None, offset: int = None):
    """
    Fetches all modules from the content_library table.
    Explicitly selects columns to avoid SELECT * per enterprise rules.
    Orders them by order_index.
    """
    query = supabase.table("content_library").select(
        "id, title, category_name, duration_text, video_url, podcast_url, overview_text, quiz_questions, key_module_topics, order_index, is_locked_default"
    ).order("order_index")
    
    if limit is not None and offset is not None:
        query = query.range(offset, offset + limit - 1)
        
    response = query.execute()
    
    return response.data
