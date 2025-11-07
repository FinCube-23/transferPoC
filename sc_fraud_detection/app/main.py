from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.services.alchemy_service import AlchemyService
from app.services.opensearch_service import OpenSearchService
from app.services.rag_service import RAGService
from app.api import deps
from app.api.routes import health, data, fraud

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    
    Handles startup and shutdown events:
    - Initialize services on startup
    - Clean up resources on shutdown
    """
    settings = get_settings()
    
    # Startup: Initialize services
    logger.info("Initializing services...")
    
    alchemy_service = AlchemyService(settings.alchemy_api_key)
    opensearch_service = OpenSearchService(
        settings.opensearch_host,
        settings.opensearch_port,
        settings.index_name
    )
    rag_service = RAGService(settings.google_api_key)
    
    # Set services in dependency injection
    deps.set_services(alchemy_service, opensearch_service, rag_service)
    
    # Ensure index exists
    try:
        opensearch_service.create_index(dimension=settings.feature_dim)
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    
    logger.info("Services initialized successfully")
    
    yield
    
    # Shutdown: Cleanup
    logger.info("Shutting down services...")
    await alchemy_service.close()
    logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Ethereum Fraud Detection Service",
    description="RAG-based fraud detection using K-NN and Gemini",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Include routers
app.include_router(health.router)
app.include_router(data.router)
app.include_router(fraud.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
