from dotenv import load_dotenv
load_dotenv()
from utils.supabase_client import supabase

try:
    response = supabase.rpc("get_payments_paginated", {
        "p_statuses": ["pending"],
        "p_search": None,
        "p_date_from": None,
        "p_date_to": None,
        "p_page": 1,
        "p_page_size": 20
    }).execute()
    print("Success:", response.data)
except Exception as e:
    print("Error:", repr(e))
