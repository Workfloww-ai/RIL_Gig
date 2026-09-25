import asyncio
from tracking.redis_client import get_redis

async def test():
    client = await get_redis()
    job_id = "8ac364bc-0303-4f4e-8c65-f3bebbab9bcc"
    eta = await client.get(f"job:{job_id}:latest_eta")
    print("ETA from Redis:", eta)

asyncio.run(test())
