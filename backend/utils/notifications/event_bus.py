import asyncio
import logging
from typing import Dict, Any, Optional
from utils.notifications.contract_validator import EventContractValidator
from utils.notifications.workflow_engine import WorkflowEngine

logger = logging.getLogger("EventBus")

class EventBus:
    """
    Central Asynchronous Event Bus.
    Validates event payloads against lifecycle schemas, ensures non-blocking HTTP threads,
    and dispatches background workflow processing.
    """

    @classmethod
    def publish_event(
        cls,
        event_name: str,
        user_id: str,
        payload: Optional[Dict[str, Any]] = None,
        company_id: Optional[str] = None
    ) -> None:
        """
        Non-blocking dispatch: schedules workflow evaluation in background task.
        """
        # 1. Validate payload and apply contract fallbacks
        is_valid, err_msg, cleaned_payload = EventContractValidator.validate_payload(
            event_name, payload or {}
        )
        if not is_valid:
            logger.warning(f"Event payload invalid for {event_name}: {err_msg}")

        # 2. Fire and forget task to ensure zero blocking HTTP threads
        asyncio.create_task(
            cls._async_process(event_name, user_id, cleaned_payload, company_id)
        )

    @classmethod
    async def _async_process(
        cls,
        event_name: str,
        user_id: str,
        payload: Dict[str, Any],
        company_id: Optional[str] = None
    ):
        try:
            await WorkflowEngine.process_trigger(
                trigger_lifecycle=event_name,
                user_id=user_id,
                trigger_payload=payload,
                company_id=company_id
            )
        except Exception as e:
            logger.error(f"Error executing event {event_name} for user {user_id}: {e}", exc_info=True)
