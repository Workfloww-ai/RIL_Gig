import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from utils.websocket_manager import ws_manager
from db.notifications_db import (
    get_notification_workflows,
    get_notification_template_by_id,
    schedule_bulk_notification_jobs
)
from utils.notifications.template_engine import TemplateEngine, resolve_context_value
from utils.notifications.context_enricher import NotificationContextEnricher

logger = logging.getLogger("WorkflowEngine")

class WorkflowEngine:
    """
    Visual Rule-based Workflow Automation Engine.
    Evaluates trigger matches, rule filters, cooldown throttle guardrails,
    template compilation, and enqueues jobs via atomic batch RPC.
    """

    @classmethod
    def evaluate_rule(cls, rule: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Evaluates a single rule: {"field": "score", "operator": "<", "value": "70"}
        Supported operators: ==, !=, >, <, >=, <=, in, contains
        """
        field = rule.get("field", "")
        op = rule.get("operator", "==").strip()
        target_val = rule.get("value")

        actual_val = resolve_context_value(field, context)
        if actual_val is None:
            return False

        # Type normalization for numbers
        try:
            if isinstance(actual_val, (int, float)) or (isinstance(actual_val, str) and actual_val.replace(".", "", 1).isdigit()):
                act_num = float(actual_val)
                tgt_num = float(target_val)
                if op == "==" or op == "=": return act_num == tgt_num
                if op == "!=": return act_num != tgt_num
                if op == ">": return act_num > tgt_num
                if op == "<": return act_num < tgt_num
                if op == ">=": return act_num >= tgt_num
                if op == "<=": return act_num <= tgt_num
        except Exception:
            pass

        # String or general comparisons
        act_str = str(actual_val).strip().lower()
        tgt_str = str(target_val).strip().lower()

        if op == "==" or op == "=":
            return act_str == tgt_str
        elif op == "!=":
            return act_str != tgt_str
        elif op == "contains":
            return tgt_str in act_str
        elif op == "in":
            # If target_val is a list or comma-separated string
            if isinstance(target_val, list):
                return act_str in [str(x).strip().lower() for x in target_val]
            items = [x.strip().lower() for x in str(target_val).split(",")]
            return act_str in items

        return False

    @classmethod
    def matches_rules(cls, rules: List[Dict[str, Any]], match_type: str, context: Dict[str, Any]) -> bool:
        if not rules:
            return True

        match_type = match_type.upper() if match_type else "ALL"
        if match_type == "ANY":
            return any(cls.evaluate_rule(r, context) for r in rules)
        else: # ALL
            return all(cls.evaluate_rule(r, context) for r in rules)

    @classmethod
    async def is_throttled(cls, workflow_id: str, user_id: str, cooldown_seconds: int) -> bool:
        """
        Enforces cooldown guardrails via Redis key throttle:workflow:{wf_id}:{user_id}.
        """
        if cooldown_seconds <= 0:
            return False
        try:
            r = await ws_manager.get_redis()
            key = f"throttle:workflow:{workflow_id}:{user_id}"
            exists = await r.exists(key)
            if exists:
                return True
            # Set throttle key
            await r.setex(key, cooldown_seconds, "1")
            return False
        except Exception:
            return False

    @classmethod
    def recheck_conditions_before_send(cls, workflow: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Pre-send stale-state cancellation.
        Validates whether target condition remains valid right before dispatch
        (e.g., if module was already completed, cancel deadline alert).
        """
        filter_rules = workflow.get("filter_rules") or []
        match_type = workflow.get("filter_match_type", "ALL")
        return cls.matches_rules(filter_rules, match_type, context)

    @classmethod
    async def process_trigger(
        cls,
        trigger_lifecycle: str,
        user_id: str,
        trigger_payload: Optional[Dict[str, Any]] = None,
        company_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Finds matching active workflows for trigger_lifecycle, enriches recipient context,
        evaluates filters and cooldowns, and schedules bulk notification jobs.
        """
        # 1. Fetch matching active workflows
        workflows = get_notification_workflows(trigger_lifecycle=trigger_lifecycle, active_only=True)
        if not workflows:
            return []

        # 2. Enrich context in single roundtrip / cache
        context = await NotificationContextEnricher.enrich(
            user_id=user_id,
            base_payload=trigger_payload,
            company_id=company_id
        )

        matched_jobs = []
        for wf in workflows:
            # Check filter rules
            rules = wf.get("filter_rules") or []
            match_type = wf.get("filter_match_type", "ALL")
            if not cls.matches_rules(rules, match_type, context):
                continue

            # Check cooldown throttle
            wf_id = wf["id"]
            cooldown = wf.get("cooldown_seconds", 3600)
            if await cls.is_throttled(wf_id, user_id, cooldown):
                logger.info(f"Workflow {wf_id} throttled for user {user_id}")
                continue

            # Template Resolution: Pinned template or workflow inline template
            title_tpl = wf.get("title_template", "")
            body_tpl = wf.get("body_template", "")
            pinned_tid = wf.get("pinned_template_id")
            if pinned_tid:
                tmpl = get_notification_template_by_id(pinned_tid)
                if tmpl:
                    title_tpl = tmpl.get("title_template") or title_tpl
                    body_tpl = tmpl.get("body_template") or body_tpl

            rendered_title, rendered_body = TemplateEngine.render_notification(
                title_tpl, body_tpl, context
            )

            job_metadata = {
                "workflow_id": wf_id,
                "title": rendered_title,
                "message": rendered_body,
                "channels": wf.get("channels", ["IN_APP", "PUSH"]),
                "delivery_policy": wf.get("delivery_policy", "PARALLEL"),
                "trigger_lifecycle": trigger_lifecycle,
                "action_url": context.get("curriculum.action_url") or context.get("action_url"),
                "context": context
            }

            # Enqueue to notification_jobs via atomic batch RPC with deterministic idempotency
            inserted_count = schedule_bulk_notification_jobs(
                user_ids=[user_id],
                notification_type=wf.get("notification_type", "SYSTEM"),
                metadata=job_metadata,
                assignment_id=trigger_payload.get("assignment_id") if trigger_payload else None
            )

            matched_jobs.append({
                "workflow_id": wf_id,
                "scheduled": inserted_count > 0,
                "title": rendered_title,
                "body": rendered_body
            })

        return matched_jobs
