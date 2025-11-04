import asyncio
import json
from collections import defaultdict
from typing import AsyncGenerator, Dict, Set, Any, Optional


class ProjectEventBus:
    def __init__(self) -> None:
        self._subscribers: Dict[int, Set[asyncio.Queue[str]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, project_id: int) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers[project_id].add(queue)
        return queue

    async def unsubscribe(self, project_id: int, queue: asyncio.Queue[str]) -> None:
        async with self._lock:
            if queue in self._subscribers.get(project_id, set()):
                self._subscribers[project_id].remove(queue)
            if not self._subscribers.get(project_id):
                self._subscribers.pop(project_id, None)

    async def publish(self, project_id: int, message: str) -> None:
        # Fan out; drop if queue is full to avoid blocking producers
        subs = list(self._subscribers.get(project_id, set()))
        for q in subs:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # best effort; skip
                pass


bus = ProjectEventBus()


async def project_sse_stream(project_id: int) -> AsyncGenerator[bytes, None]:
    queue = await bus.subscribe(project_id)
    try:
        # Initial hello to open stream
        yield b":ok\n\n"
        while True:
            msg = await queue.get()
            data = f"data: {msg}\n\n".encode("utf-8")
            yield data
    finally:
        await bus.unsubscribe(project_id, queue)


async def notify_project(
    project_id: int,
    kind: str = "updated",
    user_id: Optional[int] = None,
    user_name: Optional[str] = None,
    task_id: Optional[int] = None,
    task_name: Optional[str] = None,
    project_name: Optional[str] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None
) -> None:
    """Send detailed notification event to all project subscribers."""
    event_data = {
        "kind": kind,
        "project_id": project_id,
        "project_name": project_name,
        "user_id": user_id,
        "user_name": user_name,
        "task_id": task_id,
        "task_name": task_name,
        "old_status": old_status,
        "new_status": new_status,
    }
    if extra:
        event_data.update(extra)
    
    # Remove None values
    event_data = {k: v for k, v in event_data.items() if v is not None}
    
    await bus.publish(project_id, json.dumps(event_data))


