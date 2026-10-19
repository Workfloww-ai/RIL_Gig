from utils.supabase_client import supabase
from typing import List, Dict, Any

def get_domains_and_categories() -> List[Dict[str, Any]]:
    """
    Fetches all active job domains and all their associated job categories.
    Explicitly mentions column names to comply with enterprise guidelines.
    If a domain is inactive, neither the domain nor its categories are returned.
    Inactive categories are returned with is_active=False so frontend can display them as non-selectable / coming soon.
    """
    # 1. Fetch domains (only active ones)
    try:
        domains_resp = supabase.table("job_domains").select("domain_id, name, is_active").order("name").execute()
        domains_data = [d for d in (domains_resp.data or []) if d.get("is_active") is not False]
    except Exception:
        # Fallback if is_active column is not yet migrated in Supabase
        domains_resp = supabase.table("job_domains").select("domain_id, name").order("name").execute()
        domains_data = domains_resp.data or []

    active_domain_ids = {d["domain_id"] for d in domains_data}

    # 2. Fetch categories (all categories belonging to active domains)
    try:
        categories_resp = supabase.table("job_categories").select("category_id, domain_id, name, is_active").order("name").execute()
        categories_data = [
            c for c in (categories_resp.data or [])
            if c.get("domain_id") in active_domain_ids
        ]
    except Exception:
        # Fallback if is_active column is not yet migrated in Supabase
        categories_resp = supabase.table("job_categories").select("category_id, domain_id, name").order("name").execute()
        categories_data = [
            c for c in (categories_resp.data or [])
            if c.get("domain_id") in active_domain_ids
        ]

    # 3. Group categories by domain_id
    cat_by_domain: Dict[str, List[Dict[str, Any]]] = {}
    for cat in categories_data:
        dom_id = cat.get("domain_id")
        if dom_id not in cat_by_domain:
            cat_by_domain[dom_id] = []
        cat_by_domain[dom_id].append({
            "category_id": cat["category_id"],
            "name": cat["name"],
            "domain_id": cat["domain_id"],
            "is_active": cat.get("is_active") is not False
        })

    # 4. Construct final structured payload
    result = []
    for dom in domains_data:
        dom_id = dom["domain_id"]
        result.append({
            "domain_id": dom_id,
            "name": dom["name"],
            "categories": cat_by_domain.get(dom_id, [])
        })

    return result

def get_user_preferences(user_id: str) -> List[str]:
    """
    Fetches the category IDs that the user has selected.
    Explicitly selects columns to avoid SELECT *.
    """
    resp = supabase.table("user_job_preferences").select("category_id").eq("user_id", user_id).execute()
    data = resp.data or []
    return [row["category_id"] for row in data if "category_id" in row]

def save_user_preferences(user_id: str, category_ids: List[str]) -> bool:
    """
    Saves or updates the user's selected preferences.
    Domain is permanently locked once selected:
    - If the user already has preferences, they can only choose/add categories within their existing registered domain.
    - If it's first-time setup, they can choose any active domain, and all categories must belong to that single domain.
    - Inactive categories or inactive domains cannot be selected.
    """
    if not category_ids:
        raise ValueError("At least one category must be selected.")

    # Deduplicate category IDs
    unique_category_ids = list(dict.fromkeys(category_ids))

    # Fetch the domain and active status for the newly submitted categories
    try:
        cats_resp = supabase.table("job_categories").select("category_id, domain_id, name, is_active").in_("category_id", unique_category_ids).execute()
    except Exception:
        cats_resp = supabase.table("job_categories").select("category_id, domain_id, name").in_("category_id", unique_category_ids).execute()

    cats_data = cats_resp.data or []
    if not cats_data:
        raise ValueError("Invalid category IDs provided.")

    # Validate that none of the selected categories are inactive
    for c in cats_data:
        if c.get("is_active") is False:
            raise ValueError(f"Category '{c.get('name')}' is currently inactive and cannot be selected.")

    new_domain_ids = {c["domain_id"] for c in cats_data if "domain_id" in c}

    if not new_domain_ids:
        raise ValueError("Invalid category IDs provided.")

    if len(new_domain_ids) > 1:
        raise ValueError("All selected categories must belong to the same domain.")

    target_domain_id = list(new_domain_ids)[0]

    # Validate that the domain itself is active
    try:
        dom_resp = supabase.table("job_domains").select("domain_id, name, is_active").eq("domain_id", target_domain_id).limit(1).execute()
        if dom_resp.data and dom_resp.data[0].get("is_active") is False:
            raise ValueError(f"Domain '{dom_resp.data[0].get('name')}' is currently inactive. Categories in this domain cannot be chosen.")
    except ValueError:
        raise
    except Exception:
        pass

    # Check if user already has an established domain lock
    existing_cat_ids = get_user_preferences(user_id)
    prior_domain_ids = set()
    if existing_cat_ids:
        existing_cats_resp = supabase.table("job_categories").select("domain_id").in_("category_id", existing_cat_ids).execute()
        prior_domain_ids = {c["domain_id"] for c in (existing_cats_resp.data or []) if "domain_id" in c}

    if not prior_domain_ids:
        cert_ids = get_user_category_certifications(user_id)
        if cert_ids:
            cert_cats_resp = supabase.table("job_categories").select("domain_id").in_("category_id", cert_ids).execute()
            prior_domain_ids = {c["domain_id"] for c in (cert_cats_resp.data or []) if "domain_id" in c}

    if prior_domain_ids:
        locked_domain_id = list(prior_domain_ids)[0]
        if target_domain_id != locked_domain_id:
            raise ValueError("Your industry domain is locked. You can only add or update categories within your registered domain.")

    # Update user_job_preferences rows with the selections for this domain
    supabase.table("user_job_preferences").delete().eq("user_id", user_id).execute()

    rows_to_insert = [
        {
            "user_id": user_id,
            "category_id": cat_id
        }
        for cat_id in unique_category_ids
    ]
    supabase.table("user_job_preferences").insert(rows_to_insert).execute()

    return True

def get_user_category_certifications(user_id: str) -> List[str]:
    """
    Fetches the category IDs in which the user is certified.
    Explicitly selects columns.
    """
    resp = supabase.table("user_category_certifications").select("category_id").eq("user_id", user_id).execute()
    data = resp.data or []
    return [row["category_id"] for row in data if "category_id" in row]

def get_user_preferences_with_details(user_id: str) -> Dict[str, Any]:
    """
    Fetches the authenticated user's selected category preferences,
    certified categories, category metadata (names, domains), and their primary domain.
    Explicitly selects columns per enterprise guidelines.
    """
    selected_ids = get_user_preferences(user_id)
    certified_ids = get_user_category_certifications(user_id)

    all_cat_ids = list(dict.fromkeys(selected_ids + certified_ids))
    categories_info = []
    certified_info = []
    domain_info = None

    if all_cat_ids:
        try:
            cats_resp = supabase.table("job_categories").select("category_id, domain_id, name, is_active").in_("category_id", all_cat_ids).execute()
        except Exception:
            cats_resp = supabase.table("job_categories").select("category_id, domain_id, name").in_("category_id", all_cat_ids).execute()
        cats_data = cats_resp.data or []

        # Fetch domains
        dom_ids = list(dict.fromkeys([c["domain_id"] for c in cats_data if c.get("domain_id")]))
        domains_map = {}
        if dom_ids:
            doms_resp = supabase.table("job_domains").select("domain_id, name").in_("domain_id", dom_ids).execute()
            for d in (doms_resp.data or []):
                domains_map[d["domain_id"]] = d["name"]
                if not domain_info:
                    domain_info = {"domain_id": d["domain_id"], "name": d["name"]}

        cat_lookup = {}
        for c in cats_data:
            cat_obj = {
                "category_id": c["category_id"],
                "name": c["name"],
                "domain_id": c.get("domain_id"),
                "domain_name": domains_map.get(c.get("domain_id"), "General"),
                "is_active": c.get("is_active") is not False
            }
            cat_lookup[c["category_id"]] = cat_obj

        for sid in selected_ids:
            if sid in cat_lookup:
                categories_info.append(cat_lookup[sid])

        for cid in certified_ids:
            if cid in cat_lookup:
                certified_info.append(cat_lookup[cid])

    return {
        "selected_category_ids": selected_ids,
        "certified_category_ids": certified_ids,
        "categories": categories_info,
        "certified_categories": certified_info,
        "domain": domain_info
    }
