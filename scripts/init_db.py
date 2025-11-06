#!/usr/bin/env python3
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

from app.scraper.data_scraper import DataScraper
from app.services.opensearch_service import OpenSearchService
from app.utils.feature_extractor import FeatureExtractor
from app.config import get_settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    """Initialize database with Kaggle dataset"""
    settings = get_settings()
    
    # Initialize services
    scraper = DataScraper(settings.kaggle_username, settings.kaggle_key)
    opensearch = OpenSearchService(
        settings.opensearch_host,
        settings.opensearch_port,
        settings.index_name
    )
    
    # Create index
    logger.info("Creating OpenSearch index...")
    opensearch.create_index(dimension=settings.feature_dim)
    
    # Scrape Kaggle dataset
    logger.info("Scraping Kaggle dataset...")
    dataset_url = "vagifa/ethereum-frauddetection-dataset"
    records = await scraper.scrape(dataset_url, "kaggle")
    
    logger.info(f"Processing {len(records)} records...")
    
    # Process records
    processed_records = []
    for i, record in enumerate(records):
        try:
            # Extract features
            features_dict = {k: float(v) if v is not None else 0 
                           for k, v in record.items() 
                           if k not in ['Index', 'Address', 'FLAG']}
            
            # Create feature vector
            feature_vector = FeatureExtractor.features_to_vector(features_dict)
            
            processed_records.append({
                "address": record.get("Address", ""),
                "flag": int(record.get("FLAG", 0)),
                "features": feature_vector,
                "feature_dict": features_dict
            })
            
            if (i + 1) % 1000 == 0:
                logger.info(f"Processed {i + 1}/{len(records)} records")
                
        except Exception as e:
            logger.warning(f"Error processing record {i}: {e}")
            continue
    
    # Bulk insert
    logger.info(f"Inserting {len(processed_records)} records into OpenSearch...")
    success, failed = opensearch.bulk_insert(processed_records, batch_size=500)
    
    logger.info(f"✓ Database initialization complete!")
    logger.info(f"  - Successfully inserted: {success}")
    logger.info(f"  - Failed: {len(failed)}")
    
    # Show stats
    stats = opensearch.get_index_stats()
    logger.info(f"  - Total documents: {stats['document_count']}")


if __name__ == "__main__":
    asyncio.run(main())
