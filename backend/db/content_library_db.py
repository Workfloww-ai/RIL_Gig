from utils.supabase_client import supabase
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

def initialize_user_progress_if_needed(user_id: str, modules: List[Dict[str, Any]] = None):
    """
    Checks if a user has progress rows for given modules.
    If missing, initializes them: first module of each category is in_progress, rest locked.
    """
    if modules is None:
        modules = get_all_modules()
    if not modules:
        return

    # Check existing progress rows for user
    existing_resp = supabase.table("user_module_progress").select("module_id").eq("user_id", user_id).execute()
    existing_mod_ids = {row["module_id"] for row in (existing_resp.data or [])}

    # Group modules by category to find the first module for each category
    first_mod_per_cat = {}
    for mod in modules:
        cat_key = mod.get("category_id") or mod.get("category_name") or "default"
        if cat_key not in first_mod_per_cat:
            first_mod_per_cat[cat_key] = mod["id"]

    progress_rows = []
    for mod in modules:
        if mod["id"] not in existing_mod_ids:
            cat_key = mod.get("category_id") or mod.get("category_name") or "default"
            is_first = (first_mod_per_cat.get(cat_key) == mod["id"]) or (mod.get("order_index") == 1)
            status = "in_progress" if is_first else "locked"
            progress_rows.append({
                "user_id": user_id,
                "module_id": mod["id"],
                "status": status
            })

    if progress_rows:
        supabase.table("user_module_progress").insert(progress_rows).execute()

def get_modules_with_progress(user_id: str, limit: int = 100, offset: int = 0):
    """
    Fetches modules filtered by worker's selected job preferences,
    and joins with the worker's progress.
    """
    # 1. Fetch user's category preferences
    prefs_resp = supabase.table("user_job_preferences").select("category_id").eq("user_id", user_id).execute()
    pref_cat_ids = [p["category_id"] for p in (prefs_resp.data or []) if "category_id" in p]

    # Fetch all modules
    all_modules = get_all_modules(limit=limit, offset=offset)

    # 2. Filter modules by preferences if user has selected preferences
    if pref_cat_ids:
        # Get category names for fallback matching on legacy rows
        cats_resp = supabase.table("job_categories").select("category_id, name").in_("category_id", pref_cat_ids).execute()
        pref_names = [c["name"].strip().lower() for c in (cats_resp.data or [])]

        filtered_modules = []
        for mod in all_modules:
            mod_cat_id = mod.get("category_id")
            mod_cat_name = (mod.get("category_name") or "").strip().lower()

            if (mod_cat_id and mod_cat_id in pref_cat_ids) or (mod_cat_name in pref_names):
                filtered_modules.append(mod)

        # If matching modules found, use them; otherwise show all
        modules = filtered_modules if filtered_modules else all_modules
    else:
        modules = all_modules

    # Ensure progress rows exist for these modules
    initialize_user_progress_if_needed(user_id, modules)

    # 3. Fetch user progress
    progress_resp = supabase.table("user_module_progress").select(
        "module_id, status, highest_quiz_score, completed_at"
    ).eq("user_id", user_id).execute()
    progress_dict = {p["module_id"]: p for p in (progress_resp.data or [])}

    # 4. Merge progress
    merged = []
    for mod in modules:
        mod_prog = progress_dict.get(mod["id"])
        mod["status"] = mod_prog["status"] if mod_prog else "locked"
        mod["highest_quiz_score"] = mod_prog["highest_quiz_score"] if mod_prog else 0
        mod["completed_at"] = mod_prog.get("completed_at") if mod_prog else None
        merged.append(mod)

    return merged

def process_quiz_submission(user_id: str, module_id: str, score: int, passing_score: int = 80):
    """
    Saves the quiz score. If passed:
    - Unlocks the next module in this category.
    - Checks if ALL modules in this category are completed, and if so,
      awards a category certification in user_category_certifications.
    """
    # 1. Get current progress for this module
    curr_prog = supabase.table("user_module_progress").select(
        "id, status, highest_quiz_score"
    ).eq("user_id", user_id).eq("module_id", module_id).execute()

    if not curr_prog.data:
        raise Exception("Module progress not found")

    prog = curr_prog.data[0]
    current_highest = prog.get("highest_quiz_score") or 0
    new_highest = max(score, current_highest)

    passed = score >= passing_score
    new_status = "quiz_passed" if passed else prog["status"]

    update_data = {
        "highest_quiz_score": new_highest,
        "status": new_status
    }

    if passed and prog["status"] != "quiz_passed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    supabase.table("user_module_progress").update(update_data).eq("id", prog["id"]).execute()

    category_certified = False
    certified_category_name = None

    if passed:
        # Get module category details and order_index
        curr_module_resp = supabase.table("content_library").select(
            "id, order_index, category_id, category_name"
        ).eq("id", module_id).single().execute()

        curr_module = curr_module_resp.data or {}
        cat_id = curr_module.get("category_id")
        cat_name = curr_module.get("category_name")

        # Unlock next module
        next_module_resp = supabase.table("content_library").select("id").eq(
            "order_index", curr_module.get("order_index", 0) + 1
        ).execute()

        if next_module_resp.data:
            next_mod_id = next_module_resp.data[0]["id"]
            next_prog = supabase.table("user_module_progress").select("id, status").eq(
                "user_id", user_id
            ).eq("module_id", next_mod_id).single().execute()

            if next_prog.data and next_prog.data.get("status") == "locked":
                supabase.table("user_module_progress").update(
                    {"status": "in_progress"}
                ).eq("id", next_prog.data["id"]).execute()

        # ========================================================
        # Category Certification Check
        # ========================================================
        # Find all modules for this category
        cat_modules_query = supabase.table("content_library").select("id")
        if cat_id:
            cat_modules_query = cat_modules_query.eq("category_id", cat_id)
        elif cat_name:
            cat_modules_query = cat_modules_query.ilike("category_name", cat_name)

        cat_modules_resp = cat_modules_query.execute()
        cat_mod_ids = [m["id"] for m in (cat_modules_resp.data or [])]

        if cat_mod_ids:
            # Check user progress for all modules in this category
            cat_progress_resp = supabase.table("user_module_progress").select(
                "module_id, status"
            ).eq("user_id", user_id).in_("module_id", cat_mod_ids).execute()

            passed_mod_ids = {
                p["module_id"] for p in (cat_progress_resp.data or []) if p.get("status") == "quiz_passed"
            }

            # All modules in this category have been passed!
            if len(passed_mod_ids) == len(cat_mod_ids):
                # Resolve category_id if missing from module
                target_cat_id = cat_id
                if not target_cat_id and cat_name:
                    cat_lookup = supabase.table("job_categories").select("category_id, name").ilike(
                        "name", cat_name
                    ).limit(1).execute()
                    if cat_lookup.data:
                        target_cat_id = cat_lookup.data[0]["category_id"]
                        cat_name = cat_lookup.data[0]["name"]

                if target_cat_id:
                    # Check if already certified
                    existing_cert = supabase.table("user_category_certifications").select(
                        "certification_id"
                    ).eq("user_id", user_id).eq("category_id", target_cat_id).limit(1).execute()

                    if not existing_cert.data:
                        supabase.table("user_category_certifications").insert({
                            "user_id": user_id,
                            "category_id": target_cat_id
                        }).execute()

                    try:
                        supabase.table("users").update({"is_certified": True}).eq("user_id", user_id).execute()
                    except Exception:
                        pass

                    category_certified = True
                    certified_category_name = cat_name

    return {
        "success": True,
        "passed": passed,
        "score": score,
        "category_certified": category_certified,
        "certified_category_name": certified_category_name
    }

def get_all_modules(limit: int = None, offset: int = None):
    """
    Fetches all modules from content_library table.
    Explicitly mentions column names per enterprise guidelines.
    """
    query = supabase.table("content_library").select(
        "id, title, title_hinglish, title_bengali, category_id, category_name, duration_text, "
        "video_url, video_url_hinglish, video_url_bengali, podcast_url, podcast_url_hinglish, "
        "podcast_url_bengali, overview_text, overview_text_hinglish, overview_text_bengali, "
        "quiz_questions, quiz_questions_hinglish, quiz_questions_bengali, key_module_topics, "
        "key_module_topics_hinglish, key_module_topics_bengali, order_index, is_locked_default"
    ).order("order_index")

    if limit is not None and offset is not None:
        query = query.range(offset, offset + limit - 1)

    response = query.execute()
    return response.data or []
