import os
import json
import uuid
import asyncio
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
import jwt

CHANNEL_NAME = "notifications:pubsub"

class WebSocketManager:
    """
    Distributed WebSocket Manager with Multi-Instance Redis Pub/Sub Broadcast
    and Loopback Deduplication via instance_id.
    """
    def __init__(self):
        self.instance_id: str = uuid.uuid4().hex
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.redis_client: Optional[aioredis.Redis] = None
        self.pubsub_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self.secret_key = os.getenv("JWT_SECRET_KEY", "fallback_secret")
        self.algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    async def get_redis(self) -> aioredis.Redis:
        if self.redis_client is None:
            self.redis_client = aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=5
            )
        return self.redis_client

    async def start(self):
        """
        Starts the background Redis Pub/Sub subscriber loop.
        """
        if self.pubsub_task is None or self.pubsub_task.done():
            self.pubsub_task = asyncio.create_task(self._redis_consumer_loop())

    async def stop(self):
        """
        Stops the subscriber and closes Redis connection.
        """
        if self.pubsub_task:
            self.pubsub_task.cancel()
            try:
                await self.pubsub_task
            except asyncio.CancelledError:
                pass
        if self.redis_client:
            await self.redis_client.aclose()
            self.redis_client = None

    async def connect(self, websocket: WebSocket, user_id: str):
        """
        Accepts and registers a WebSocket connection for user_id.
        """
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
        # Ensure redis consumer loop is running
        await self.start()

    async def disconnect(self, websocket: WebSocket, user_id: str):
        """
        Unregisters a WebSocket connection.
        """
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

    async def send_personal_message(self, user_id: str, message: Any):
        """
        Publishes a message targeted at user_id to Redis pub/sub with loopback envelope,
        and delivers directly to any local sockets on this instance.
        """
        # 1. Deliver directly to local sockets on this instance
        await self._deliver_locally(user_id, message)

        # 2. Invalidate / increment unread count in Redis
        try:
            r = await self.get_redis()
            await r.incr(f"unread_count:{user_id}")
        except Exception as e:
            pass

        # 3. Broadcast to peer instances via Redis envelope
        envelope = {
            "type": "personal",
            "user_id": str(user_id),
            "message": message,
            "sender_instance_id": self.instance_id,
        }
        try:
            r = await self.get_redis()
            await r.publish(CHANNEL_NAME, json.dumps(envelope))
        except Exception as e:
            pass

    async def broadcast(self, message: Any):
        """
        Broadcasts message to all connected users across all instances.
        """
        envelope = {
            "type": "broadcast",
            "message": message,
            "sender_instance_id": self.instance_id,
        }
        # Deliver locally first
        for uid in list(self.active_connections.keys()):
            await self._deliver_locally(uid, message)

        try:
            r = await self.get_redis()
            await r.publish(CHANNEL_NAME, json.dumps(envelope))
        except Exception:
            pass

    async def invalidate_unread_cache(self, user_id: str):
        """
        Deletes the cached unread count in Redis so next lookup fetches freshly from DB.
        """
        try:
            r = await self.get_redis()
            await r.delete(f"unread_count:{user_id}")
        except Exception:
            pass

    async def get_cached_unread_count(self, user_id: str) -> Optional[int]:
        """
        Reads cached unread badge count from Redis.
        """
        try:
            r = await self.get_redis()
            val = await r.get(f"unread_count:{user_id}")
            if val is not None:
                return int(val)
        except Exception:
            pass
        return None

    async def set_cached_unread_count(self, user_id: str, count: int, ttl: int = 300):
        """
        Sets cached unread badge count in Redis.
        """
        try:
            r = await self.get_redis()
            await r.setex(f"unread_count:{user_id}", ttl, str(count))
        except Exception:
            pass

    async def _deliver_locally(self, user_id: str, message: Any):
        """
        Sends message to all active sockets connected to this instance for user_id.
        """
        sockets = self.active_connections.get(str(user_id), set()).copy()
        if not sockets:
            return

        payload_str = json.dumps(message) if not isinstance(message, str) else message
        dead_sockets = set()
        for ws in sockets:
            try:
                await ws.send_text(payload_str)
            except Exception:
                dead_sockets.add(ws)

        if dead_sockets:
            async with self._lock:
                if str(user_id) in self.active_connections:
                    self.active_connections[str(user_id)] -= dead_sockets

    async def _redis_consumer_loop(self):
        """
        Subscribes to Redis Pub/Sub channel and dispatches incoming envelopes.
        Loopback Deduplication: Discards messages originating from this instance_id.
        """
        while True:
            try:
                r = await self.get_redis()
                pubsub = r.pubsub()
                await pubsub.subscribe(CHANNEL_NAME)
                async for raw_msg in pubsub.listen():
                    if raw_msg.get("type") != "message":
                        continue
                    try:
                        data = json.loads(raw_msg["data"])
                    except Exception:
                        continue

                    # Loopback suppression: discard self-generated broadcast messages
                    if data.get("sender_instance_id") == self.instance_id:
                        continue

                    msg_type = data.get("type")
                    if msg_type == "personal":
                        target_user = data.get("user_id")
                        if target_user and target_user in self.active_connections:
                            await self._deliver_locally(target_user, data.get("message"))
                    elif msg_type == "broadcast":
                        for uid in list(self.active_connections.keys()):
                            await self._deliver_locally(uid, data.get("message"))
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Exponential backoff on network partition
                await asyncio.sleep(2.0)

    def verify_token(self, token: str) -> Optional[str]:
        """
        Decodes JWT token and returns user_id if valid.
        """
        if not token:
            return None
        # Clean Bearer prefix if present
        if token.startswith("Bearer "):
            token = token[7:]
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            user_id = payload.get("sub") or payload.get("user_id")
            return str(user_id) if user_id else None
        except Exception:
            return None

# Singleton manager instance
ws_manager = WebSocketManager()

async def notification_websocket_endpoint(websocket: WebSocket):
    """
    FastAPI WebSocket Handler at /api/notifications/ws.
    Authentication logic:
    1. Check query parameter '?token=...'
    2. Check header 'Sec-WebSocket-Protocol'
    3. If missing, wait up to 3.0s for initial frame: {"type": "auth", "token": "..."}
    4. If invalid or timed out: Close with code 1008 (Policy Violation).
    5. Handle 'ping' -> responds with 'pong'.
    """
    token: Optional[str] = websocket.query_params.get("token")
    if not token:
        sec_protocol = websocket.headers.get("sec-websocket-protocol")
        if sec_protocol:
            # Protocol header can be comma separated
            tokens = [p.strip() for p in sec_protocol.split(",")]
            token = tokens[0] if tokens else None

    user_id: Optional[str] = ws_manager.verify_token(token) if token else None

    # If no token in handshake, accept provisionally and give 3.0s grace window
    if not user_id:
        await websocket.accept()
        try:
            initial_msg = await asyncio.wait_for(websocket.receive_text(), timeout=3.0)
            data = json.loads(initial_msg)
            if data.get("type") == "auth" and data.get("token"):
                user_id = ws_manager.verify_token(data["token"])
        except Exception:
            user_id = None

        if not user_id:
            await websocket.close(code=1008, reason="Authentication failed")
            return

        # Register authenticated connection
        async with ws_manager._lock:
            if user_id not in ws_manager.active_connections:
                ws_manager.active_connections[user_id] = set()
            ws_manager.active_connections[user_id].add(websocket)
        await ws_manager.start()
    else:
        await ws_manager.connect(websocket, user_id)

    # Listen loop
    try:
        while True:
            text = await websocket.receive_text()
            if text.strip() == "ping" or text.strip() == '{"type":"ping"}':
                await websocket.send_text("pong")
            else:
                try:
                    parsed = json.loads(text)
                    if parsed.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                except Exception:
                    pass
    except (WebSocketDisconnect, Exception):
        await ws_manager.disconnect(websocket, user_id)
