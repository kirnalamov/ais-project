import asyncio
from collections import defaultdict
from typing import AsyncGenerator, Dict, Set


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


async def notify_project(project_id: int, kind: str = "updated") -> None:
    await bus.publish(project_id, kind)


