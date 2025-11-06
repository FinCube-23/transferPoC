"""
Initialize database with Kaggle dataset

Usage:
    python scripts/init_db.py
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.opensearch_service import OpenSearchService
from app.config import get_settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    """Initialize database with Kaggle dataset"""
    settings = get_settings()
    
    # Initialize services
    opensearch = OpenSearchService(
        settings.opensearch_host,
        settings.opensearch_port,
        settings.index_name
    )
    
    # Create index
    logger.info("Creating OpenSearch index...")
    opensearch.create_index(dimension=settings.feature_dim)
    
    
    
    
    logger.info(f"✓ Database initialization complete!")
    
    # Show stats
    stats = opensearch.get_index_stats()
    logger.info(f"  - Total documents: {stats['document_count']}")


if __name__ == "__main__":
    asyncio.run(main())
