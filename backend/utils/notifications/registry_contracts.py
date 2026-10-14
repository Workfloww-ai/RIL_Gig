from typing import Dict, Any, List

# 34 Standardized System Variables across 6 Canonical Namespaces
SYSTEM_VARIABLES: Dict[str, Dict[str, Any]] = {
    # 1. Subscriber Namespace
    "subscriber.first_name": {"type": "string", "description": "Subscriber first name", "example": "Aarav"},
    "subscriber.last_name": {"type": "string", "description": "Subscriber last name", "example": "Sharma"},
    "subscriber.full_name": {"type": "string", "description": "Subscriber full name", "example": "Aarav Sharma"},
    "subscriber.email": {"type": "string", "description": "Subscriber email address", "example": "aarav@example.com"},
    "subscriber.company_name": {"type": "string", "description": "Subscriber company/employer name", "example": "Reliance Retail"},
    "subscriber.email_unsubscribed": {"type": "boolean", "description": "Whether user opted out of emails", "example": False},
    "subscriber.role": {"type": "string", "description": "User role in organization", "example": "Store Associate"},

    # 2. Curriculum & Learning Namespace
    "curriculum.module_title": {"type": "string", "description": "Current learning module title", "example": "Inventory Scanning Basics"},
    "curriculum.module_id": {"type": "string", "description": "Identifier of the module", "example": "mod-101"},
    "curriculum.course_name": {"type": "string", "description": "Parent course name", "example": "Retail Store Excellence"},
    "curriculum.progress_percentage": {"type": "number", "description": "Completion percentage 0-100", "example": 75},
    "curriculum.days_left": {"type": "integer", "description": "Days remaining until deadline", "example": 3},
    "curriculum.deadline_date": {"type": "string", "description": "Target completion date", "example": "2026-10-20"},
    "curriculum.action_url": {"type": "string", "description": "Deep-link target URL for learning module", "example": "/app/library/mod-101"},

    # 3. Assessment & Performance Namespace
    "assessment.title": {"type": "string", "description": "Title of assessment", "example": "Store Safety Certification"},
    "assessment.score": {"type": "number", "description": "Achieved assessment score", "example": 88},
    "assessment.passing_score": {"type": "number", "description": "Passing threshold score", "example": 80},
    "assessment.passed": {"type": "boolean", "description": "Whether assessment was passed", "example": True},
    "assessment.attempts_count": {"type": "integer", "description": "Number of attempts taken", "example": 1},
    "assessment.max_attempts": {"type": "integer", "description": "Maximum allowed attempts", "example": 3},
    "assessment.feedback": {"type": "string", "description": "Automated evaluation feedback", "example": "Great work on fire safety guidelines!"},

    # 4. Gamification Namespace
    "gamification.streak_days": {"type": "integer", "description": "Current consecutive active streak days", "example": 7},
    "gamification.points_earned": {"type": "integer", "description": "XP or coins awarded for activity", "example": 150},
    "gamification.total_points": {"type": "integer", "description": "Lifetime XP accumulated", "example": 2450},
    "gamification.badge_name": {"type": "string", "description": "Name of newly unlocked badge", "example": "7-Day Streak Warrior"},
    "gamification.badge_icon_url": {"type": "string", "description": "URL to badge asset icon", "example": "/assets/badges/streak-7.png"},
    "gamification.leaderboard_rank": {"type": "integer", "description": "Current position on team leaderboard", "example": 3},

    # 5. VARK & Adaptive Learning Namespace
    "vark.primary_style": {"type": "string", "description": "Visual, Auditory, Reading, or Kinesthetic", "example": "Visual"},
    "vark.secondary_style": {"type": "string", "description": "Secondary cognitive learning preference", "example": "Kinesthetic"},
    "vark.suggested_format": {"type": "string", "description": "Interactive simulation, video summary, or checklist", "example": "Interactive Simulation"},

    # 6. Recommendations & Smart Content Namespace
    "recommendations.title": {"type": "string", "description": "Suggested micro-lesson title", "example": "POS Barcode Scanner Troubleshooting"},
    "recommendations.duration_minutes": {"type": "integer", "description": "Estimated time to complete", "example": 4},
    "recommendations.rationale": {"type": "string", "description": "Reason this lesson was recommended", "example": "Based on recent cashier shifts"},
    "recommendations.priority": {"type": "string", "description": "HIGH, MEDIUM, LOW", "example": "HIGH"},
}

# Variable Fallbacks: Safe defaults ensuring templates never display blank strings
VARIABLE_FALLBACKS: Dict[str, Any] = {
    "subscriber.first_name": "there",
    "subscriber.full_name": "Learner",
    "subscriber.company_name": "Your Company",
    "subscriber.role": "Associate",
    "curriculum.module_title": "your assigned module",
    "curriculum.course_name": "your training course",
    "curriculum.progress_percentage": 0,
    "curriculum.days_left": 3,
    "assessment.title": "your assessment",
    "assessment.score": 0,
    "assessment.passing_score": 80,
    "assessment.passed": False,
    "gamification.streak_days": 1,
    "gamification.points_earned": 50,
    "gamification.badge_name": "Achievement Unlocked",
    "gamification.leaderboard_rank": 1,
    "vark.primary_style": "interactive",
    "recommendations.title": "your next recommended lesson",
    "recommendations.duration_minutes": 5,
}

# 25 Standard System Trigger Lifecycle Presets across Categories
TRIGGER_LIFECYCLES: List[Dict[str, Any]] = [
    # 1. Onboarding & Registration
    {"key": "USER_REGISTERED", "category": "ONBOARDING", "label": "User Registered", "description": "Triggered when a worker creates their account"},
    {"key": "KYC_VERIFIED", "category": "ONBOARDING", "label": "KYC Verified", "description": "Triggered when identity documents are approved"},
    {"key": "WELCOME_COMPLETED", "category": "ONBOARDING", "label": "Welcome Orientation Completed", "description": "Triggered upon finishing walkthrough"},

    # 2. Learning & Curriculum
    {"key": "MODULE_ASSIGNED", "category": "LEARNING", "label": "Module Assigned", "description": "Triggered when store manager assigns training"},
    {"key": "MODULE_STARTED", "category": "LEARNING", "label": "Module Started", "description": "Triggered upon opening lesson"},
    {"key": "MODULE_HALFWAY", "category": "LEARNING", "label": "Module 50% Progress", "description": "Triggered when reaching midpoint"},
    {"key": "MODULE_COMPLETED", "category": "LEARNING", "label": "Module Completed", "description": "Triggered upon 100% completion"},
    {"key": "DEADLINE_APPROACHING_48H", "category": "LEARNING", "label": "Deadline in 48 Hours", "description": "Triggered 2 days before due date"},
    {"key": "DEADLINE_APPROACHING_24H", "category": "LEARNING", "label": "Deadline in 24 Hours", "description": "Urgent reminder 1 day before due date"},
    {"key": "DEADLINE_OVERDUE", "category": "LEARNING", "label": "Module Overdue", "description": "Triggered when deadline has elapsed"},

    # 3. Assessment & Quizzes
    {"key": "ASSESSMENT_STARTED", "category": "ASSESSMENT", "label": "Assessment Started", "description": "Triggered upon beginning quiz"},
    {"key": "ASSESSMENT_COMPLETED", "category": "ASSESSMENT", "label": "Assessment Completed", "description": "Triggered when quiz score is submitted"},
    {"key": "ASSESSMENT_PASSED", "category": "ASSESSMENT", "label": "Assessment Passed", "description": "Score meets or exceeds passing threshold"},
    {"key": "ASSESSMENT_FAILED", "category": "ASSESSMENT", "label": "Assessment Failed", "description": "Score below passing threshold"},

    # 4. Gamification & Retention
    {"key": "DAILY_STREAK_CHECK", "category": "GAMIFICATION", "label": "Daily Streak Check", "description": "Triggered by cron to evaluate active streaks"},
    {"key": "STREAK_AT_RISK", "category": "GAMIFICATION", "label": "Streak At Risk", "description": "Reminder sent before midnight to maintain streak"},
    {"key": "STREAK_MILESTONE_REACHED", "category": "GAMIFICATION", "label": "Streak Milestone Reached", "description": "Awarded for 3, 7, 14, 30 days"},
    {"key": "BADGE_EARNED", "category": "GAMIFICATION", "label": "Badge Earned", "description": "Triggered when special achievement unlocked"},
    {"key": "POINTS_AWARDED", "category": "GAMIFICATION", "label": "XP Points Awarded", "description": "Triggered when XP credited to profile"},

    # 5. Job Operations & Shifts
    {"key": "JOB_ASSIGNED", "category": "OPERATIONS", "label": "Gig Shift Assigned", "description": "Triggered when worker is assigned to store"},
    {"key": "SHIFT_T90_REMINDER", "category": "OPERATIONS", "label": "Shift T-90 Mins Reminder", "description": "Triggered 90 minutes before shift starts"},
    {"key": "SHIFT_T60_REMINDER", "category": "OPERATIONS", "label": "Shift T-60 Mins Reminder", "description": "Triggered 60 minutes before shift starts"},
    {"key": "SHIFT_CHECKIN_CONFIRMED", "category": "OPERATIONS", "label": "Shift Check-In Confirmed", "description": "Triggered when OTP verified at store"},
    {"key": "PAYMENT_PROCESSED", "category": "OPERATIONS", "label": "Payment Dispatched", "description": "Triggered when payout is transferred"},

    # 6. System & Security
    {"key": "SECURITY_ALERT", "category": "SYSTEM", "label": "Security Alert (Bypass Quiet Hours)", "description": "Critical security or account notification"},
]
