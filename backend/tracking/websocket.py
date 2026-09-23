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

# Background task to listen to Redis Pub/Sub and broadcast to WebSockets
async def redis_listener(job_id: str):
    redis_client = await get_redis()
    pubsub = redis_client.pubsub()
    channel = f"job:{job_id}:location_updates"
    await pubsub.subscribe(channel)
    print(f"[Redis Pub/Sub] Subscribed to {channel}")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                # Add type identifier for the client
                data["type"] = "worker_location_update"
                await manager.broadcast(job_id, data)
    except asyncio.CancelledError:
        print(f"[Redis Pub/Sub] Unsubscribing from {channel}")
        await pubsub.unsubscribe(channel)
    except Exception as e:
        print(f"[Redis Pub/Sub] Error listening to channel {channel}: {e}")

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
        # Since locations are keyed by worker_id, we need to find the one matching this job_id
        keys = await redis_client.keys("worker:*:location")
        for key in keys:
            loc_str = await redis_client.get(key)
            if loc_str:
                loc_data = json.loads(loc_str)
                if loc_data.get("job_id") == job_id:
                    # worker:123:location -> 123
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
        
    # Start the Redis listener for this job if it's the first connection
    # Note: In a production environment with many workers, 
    # it might be better to have a single listener reading all channels
    # to avoid creating too many async tasks, but this works for isolation.
    listener_task = None
    if len(manager.active_connections[job_id]) == 1:
        listener_task = asyncio.create_task(redis_listener(job_id))
    
    try:
        while True:
            # We don't expect the client to send data, but we must keep the connection open
            data = await websocket.receive_text()
            # Handle Ping/Pong if necessary
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
    finally:
        if listener_task and job_id not in manager.active_connections:
            listener_task.cancel()
