from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Health"])

@router.get("/health")
async def health():
    """
    Health check endpoint to verify that the API is running.
    """
    return {"status": "healthy"}