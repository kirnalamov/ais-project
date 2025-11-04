from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..events import project_sse_stream


router = APIRouter()


@router.get("/projects/{project_id}/stream")
async def project_events(project_id: int):
    return StreamingResponse(project_sse_stream(project_id), media_type="text/event-stream")


