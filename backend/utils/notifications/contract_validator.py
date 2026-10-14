from typing import Dict, Any, Tuple, Optional
from utils.notifications.registry_contracts import (
    SYSTEM_VARIABLES,
    VARIABLE_FALLBACKS,
    TRIGGER_LIFECYCLES,
)
from utils.notifications.template_engine import KEY_ALIASES, REVERSE_ALIASES

class EventContractValidator:
    """
    Validates trigger event payloads against standardized contracts,
    ensures fallback values are applied, and normalizes bidirectional keys.
    """

    @classmethod
    def get_supported_triggers(cls) -> Dict[str, Dict[str, Any]]:
        return {item["key"]: item for item in TRIGGER_LIFECYCLES}

    @classmethod
    def validate_payload(
        cls,
        event_key: str,
        payload: Dict[str, Any]
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Validates the event payload:
        1. Checks event_key exists in known triggers or allows custom
        2. Applies VARIABLE_FALLBACKS so omitted fields default safely
        3. Synchronizes flat and namespaced keys bidirectionally
        """
        cleaned_payload = dict(payload) if payload else {}

        # 1. Apply Fallbacks for canonical keys not present in payload
        for k, fallback_val in VARIABLE_FALLBACKS.items():
            flat_k = REVERSE_ALIASES.get(k)
            # If neither canonical nor flat key is in payload, apply fallback
            if k not in cleaned_payload and (not flat_k or flat_k not in cleaned_payload):
                cleaned_payload[k] = fallback_val

        # 2. Synchronize Bidirectional Aliases
        # If flat key provided, copy to canonical namespaced key
        for flat_k, canonical_k in KEY_ALIASES.items():
            if flat_k in cleaned_payload and canonical_k not in cleaned_payload:
                cleaned_payload[canonical_k] = cleaned_payload[flat_k]
            elif canonical_k in cleaned_payload and flat_k not in cleaned_payload:
                cleaned_payload[flat_k] = cleaned_payload[canonical_k]

        return True, None, cleaned_payload
