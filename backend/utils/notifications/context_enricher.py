import json
from typing import Dict, Any, Optional
import redis.asyncio as aioredis
from utils.websocket_manager import ws_manager
from db.notifications_db import get_recipient_context
from utils.notifications.template_engine import KEY_ALIASES, REVERSE_ALIASES
from utils.notifications.registry_contracts import VARIABLE_FALLBACKS

CACHE_PREFIX = "notif_context:"
CACHE_TTL = 300  # 300 seconds (5 minutes)

class NotificationContextEnricher:
    """
    Enriches notification trigger events with recipient profile, organization,
    and gamification context in a single SQL roundtrip or from 300s Redis cache.
    """

    @classmethod
    async def get_cached_context(cls, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            r = await ws_manager.get_redis()
            raw = await r.get(f"{CACHE_PREFIX}{user_id}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
        return None

    @classmethod
    async def set_cached_context(cls, user_id: str, context: Dict[str, Any], ttl: int = CACHE_TTL):
        try:
            r = await ws_manager.get_redis()
            await r.setex(f"{CACHE_PREFIX}{user_id}", ttl, json.dumps(context))
        except Exception:
            pass

    @classmethod
    async def invalidate_context_cache(cls, user_id: str):
        try:
            r = await ws_manager.get_redis()
            await r.delete(f"{CACHE_PREFIX}{user_id}")
        except Exception:
            pass

    @classmethod
    async def enrich(
        cls,
        user_id: str,
        base_payload: Optional[Dict[str, Any]] = None,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Consolidates context:
        1. Checks Redis cache `notif_context:{user_id}` (300s TTL)
        2. On cache miss, executes get_recipient_context (backed by Postgres RPC)
        3. Merges base_payload with override priority (trigger data overrides default context)
        4. Synchronizes bidirectional aliases
        """
        # 1. Fetch from cache or DB
        cached_ctx = await cls.get_cached_context(user_id)
        if cached_ctx is None:
            # Single roundtrip RPC execution
            cached_ctx = get_recipient_context(user_id, company_id)
            if cached_ctx:
                await cls.set_cached_context(user_id, cached_ctx)

        enriched: Dict[str, Any] = dict(VARIABLE_FALLBACKS)
        if cached_ctx:
            enriched.update(cached_ctx)

        # 2. Trigger payload overrides default context
        if base_payload:
            enriched.update(base_payload)

        # 3. Synchronize bidirectional aliases so namespaced and flat access work identically
        for flat_k, canonical_k in KEY_ALIASES.items():
            if flat_k in enriched and canonical_k not in enriched:
                enriched[canonical_k] = enriched[flat_k]
            elif canonical_k in enriched and flat_k not in enriched:
                enriched[flat_k] = enriched[canonical_k]

        return enriched
