from fastapi import APIRouter, HTTPException, Depends, status
from utils.jwt_auth import get_current_user
from db.preferences_db import (
    get_domains_and_categories,
    get_user_preferences,
    save_user_preferences,
    get_user_category_certifications,
    get_user_preferences_with_details,
)
from .schemas import (
    TaxonomyResponse,
    UserPreferencesResponse,
    SavePreferencesRequest,
    ActionResponse,
)

router = APIRouter()

@router.get("/categories", response_model=TaxonomyResponse)
async def get_taxonomy():
    """
    Fetches all available job domains and nested categories.
    Open for worker selection during onboarding and preference updates.
    """
    try:
        domains_data = get_domains_and_categories()
        return TaxonomyResponse(status="success", domains=domains_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch job categories: {str(e)}"
        )

@router.get("/my", response_model=UserPreferencesResponse)
async def get_my_preferences(user_id: str = Depends(get_current_user)):
    """
    Fetches the authenticated user's selected category preferences,
    certified categories, and rich category details.
    """
    try:
        details = get_user_preferences_with_details(user_id)
        return UserPreferencesResponse(
            status="success",
            selected_category_ids=details["selected_category_ids"],
            certified_category_ids=details["certified_category_ids"],
            categories=details["categories"],
            certified_categories=details["certified_categories"],
            domain=details["domain"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user preferences: {str(e)}"
        )

@router.post("/save", response_model=ActionResponse)
async def save_my_preferences(
    request: SavePreferencesRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Saves the user's selected category preferences.
    """
    try:
        save_user_preferences(user_id, request.category_ids)
        return ActionResponse(
            status="success",
            message="Preferences saved successfully."
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save preferences: {str(e)}"
        )
