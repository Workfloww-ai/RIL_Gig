import re
import hashlib
from typing import Dict, Any, Tuple

# Bidirectional Token Aliases: Map flat keys to namespaced canonical keys
KEY_ALIASES: Dict[str, str] = {
    "first_name": "subscriber.first_name",
    "full_name": "subscriber.full_name",
    "email": "subscriber.email",
    "company_name": "subscriber.company_name",
    "email_unsubscribed": "subscriber.email_unsubscribed",
    "module_title": "curriculum.module_title",
    "course_name": "curriculum.course_name",
    "progress_percentage": "curriculum.progress_percentage",
    "days_left": "curriculum.days_left",
    "score": "assessment.score",
    "passing_score": "assessment.passing_score",
    "passed": "assessment.passed",
    "assessment_title": "assessment.title",
    "streak_days": "gamification.streak_days",
    "points_earned": "gamification.points_earned",
    "badge_name": "gamification.badge_name",
    "rank": "gamification.leaderboard_rank",
    "learning_style": "vark.primary_style",
    "recommended_content": "recommendations.title",
}

# Reverse mapping: namespaced canonical keys to flat keys
REVERSE_ALIASES: Dict[str, str] = {v: k for k, v in KEY_ALIASES.items()}

def compute_content_hash(title: str, body: str, channel: str = "ALL") -> str:
    """
    Computes a deterministic SHA-256 hash of normalized template content.
    """
    clean_channel = channel.strip().upper() if channel else "ALL"
    clean_title = " ".join(title.split()) if title else ""
    clean_body = " ".join(body.split()) if body else ""
    normalized = f"{clean_channel}|{clean_title}|{clean_body}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def apply_filter(value: Any, filter_name: str, filter_arg: str = "") -> str:
    """
    Applies built-in filters (default, uppercase, lowercase, capitalize).
    """
    val_str = str(value) if value is not None else ""
    filt = filter_name.strip().lower()

    if filt == "default":
        if not val_str or val_str.strip() == "":
            return filter_arg.strip().strip("'\"")
        return val_str
    elif filt == "uppercase" or filt == "upper":
        return val_str.upper()
    elif filt == "lowercase" or filt == "lower":
        return val_str.lower()
    elif filt == "capitalize" or filt == "cap":
        return val_str.capitalize()
    return val_str

def resolve_context_value(key: str, context: Dict[str, Any]) -> Any:
    """
    Resolves a variable value from context, trying:
    1. Direct match
    2. KEY_ALIASES match
    3. REVERSE_ALIASES match
    """
    if key in context:
        return context[key]
    if key in KEY_ALIASES and KEY_ALIASES[key] in context:
        return context[KEY_ALIASES[key]]
    if key in REVERSE_ALIASES and REVERSE_ALIASES[key] in context:
        return context[REVERSE_ALIASES[key]]
    return None

class TemplateEngine:
    """
    Enterprise Notification Template Engine supporting:
    - Token interpolation: {{ token | filter:arg }}
    - Conditionals: {{#if condition}}...{{else}}...{{/if}}
    - Canonical token fallback
    """

    # Regex for conditionals: {{#if variable}}...{{else}}...{{/if}} or without else
    CONDITIONAL_REGEX = re.compile(
        r"\{\{#if\s+([\w\.]+)\s*\}\}(.*?)(?:\{\{else\}\}(.*?))?\{\{/if\}\}",
        re.DOTALL
    )

    # Regex for tokens: {{ token }} or {{ token | filter }} or {{ token | filter:arg }}
    TOKEN_REGEX = re.compile(
        r"\{\{\s*([\w\.]+)(?:\s*\|\s*([a-zA-Z0-9_\:\'\"]+))?\s*\}\}"
    )

    @classmethod
    def render(cls, template_str: str, context: Dict[str, Any]) -> str:
        if not template_str:
            return ""

        # 1. Process Conditionals
        def replace_conditional(match: re.Match) -> str:
            var_name = match.group(1).strip()
            true_block = match.group(2) or ""
            false_block = match.group(3) or ""

            val = resolve_context_value(var_name, context)
            is_truthy = bool(val) and val not in (0, "0", "false", "False", "null", "None", "")

            chosen_block = true_block if is_truthy else false_block
            # Recursively render inside chosen block
            return cls.render(chosen_block, context)

        rendered = cls.CONDITIONAL_REGEX.sub(replace_conditional, template_str)

        # 2. Process Token Interpolation
        def replace_token(match: re.Match) -> str:
            var_name = match.group(1).strip()
            filter_expr = match.group(2)

            val = resolve_context_value(var_name, context)

            if filter_expr:
                parts = filter_expr.split(":", 1)
                fname = parts[0]
                farg = parts[1] if len(parts) > 1 else ""
                return apply_filter(val, fname, farg)

            if val is not None:
                return str(val)
            return ""

        rendered = cls.TOKEN_REGEX.sub(replace_token, rendered)
        return rendered

    @classmethod
    def render_notification(
        cls,
        title_template: str,
        body_template: str,
        context: Dict[str, Any]
    ) -> Tuple[str, str]:
        """
        Renders both title and body templates with the provided context.
        """
        rendered_title = cls.render(title_template, context)
        rendered_body = cls.render(body_template, context)
        return rendered_title, rendered_body
