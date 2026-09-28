from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio
import json
from .redis_client import get_redis

router = APIRouter()

# Connection manager to keep track of active WebSocket clients
class ConnectionManager:
    def __init__(self):
        # job_id -> list of active WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)
        print(f"[WebSocket] Client connected to job {job_id}")

    def disconnect(self, websocket: WebSocket, job_id: str):
        if job_id in self.active_connections:
            self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
        print(f"[WebSocket] Client disconnected from job {job_id}")

    async def broadcast(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            # We must iterate over a copy of the list as it may change during iteration
            clients_count = len(self.active_connections[job_id])
            msg_type = message.get("type", "unknown")
            print(f"[WebSocket] Broadcasting {msg_type} to {clients_count} Store Manager(s) for job {job_id}")
            for connection in self.active_connections[job_id][:]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"[WebSocket] Error sending message to client: {e}")
                    self.disconnect(connection, job_id)

manager = ConnectionManager()

class GlobalRedisListener:
    def __init__(self):
        self.pubsub = None
        self.task = None
        self.subscribed_channels = set()
        
    async def get_pubsub(self):
        if self.pubsub is None:
            redis_client = await get_redis()
            self.pubsub = redis_client.pubsub()
        return self.pubsub
        
    async def start(self):
        if self.task is None:
            self.task = asyncio.create_task(self._listen())
            
    async def subscribe(self, channel: str):
        ps = await self.get_pubsub()
        if channel not in self.subscribed_channels:
            await ps.subscribe(channel)
            self.subscribed_channels.add(channel)
            print(f"[GlobalRedisListener] Subscribed to {channel}")
            # Ensure the listener loop is running
            await self.start()
            
    async def unsubscribe(self, channel: str):
        ps = await self.get_pubsub()
        if channel in self.subscribed_channels:
            await ps.unsubscribe(channel)
            self.subscribed_channels.remove(channel)
            print(f"[GlobalRedisListener] Unsubscribed from {channel}")
            
    async def _listen(self):
        ps = await self.get_pubsub()
        try:
            async for message in ps.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    data["type"] = "worker_location_update"
                    
                    # Extract job_id from channel (job:{job_id}:location_updates)
                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    
                    parts = channel.split(":")
                    if len(parts) >= 2:
                        job_id = parts[1]
                        await manager.broadcast(job_id, data)
        except Exception as e:
            print(f"[GlobalRedisListener] Error listening to pubsub: {e}")
            self.pubsub = None
            self.task = None

global_listener = GlobalRedisListener()

@router.websocket("/ws/job/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(websocket, job_id)
    
    # Send the last known location and ETA immediately so the frontend doesn't wait
    try:
        redis_client = await get_redis()
        # 1. Send last known ETA
        eta_str = await redis_client.get(f"job:{job_id}:latest_eta")
        if eta_str:
            eta_data = json.loads(eta_str)
            eta_data["type"] = "eta_update"
            await websocket.send_json(eta_data)
            
        # 2. Send last known Location
        keys = await redis_client.keys("worker:*:location")
        for key in keys:
            loc_str = await redis_client.get(key)
            if loc_str:
                loc_data = json.loads(loc_str)
                if loc_data.get("job_id") == job_id:
                    key_str = key.decode() if isinstance(key, bytes) else key
                    worker_id = key_str.split(":")[1]
                    await websocket.send_json({
                        "type": "worker_location_update",
                        "worker_id": worker_id,
                        "latitude": loc_data.get("lat"),
                        "longitude": loc_data.get("lng"),
                        "accuracy": loc_data.get("accuracy", 0),
                        "speed": loc_data.get("speed", 0),
                        "heading": loc_data.get("heading", 0),
                        "timestamp": loc_data.get("timestamp")
                    })
    except Exception as e:
        print(f"[WebSocket] Error sending initial state: {e}")
        
    # Subscribe via the global listener if it's the first connection
    channel = f"job:{job_id}:location_updates"
    if len(manager.active_connections[job_id]) == 1:
        await global_listener.subscribe(channel)
    
    try:
        while True:
            # We don't expect the client to send data, but we must keep the connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
    finally:
        # Unsubscribe if it's the last connection
        if job_id not in manager.active_connections:
            await global_listener.unsubscribe(channel)
