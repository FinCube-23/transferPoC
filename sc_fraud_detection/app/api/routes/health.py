"""
Health check and status endpoints
"""
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Ethereum Fraud Detection",
        "status": "running",
        "version": "1.0.0"
    }


@router.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "service": "fraud-detection-api",
        "version": "1.0.0"
    }
