"""
Data management endpoints

Handles data scraping, loading, and database operations
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
import logging

from app.config import get_settings
from app.models import ScraperRequest
from app.services.opensearch_service import OpenSearchService
from app.scraper.data_scraper import DataScraper
from app.utils.feature_extractor import FeatureExtractor
from app.api.deps import get_opensearch_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/stats")
async def get_stats(
    opensearch_service: OpenSearchService = Depends(get_opensearch_service)
):
    """Get database statistics"""
    try:
        stats = opensearch_service.get_index_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scrape")
async def scrape_data(
    request: ScraperRequest,
    background_tasks: BackgroundTasks,
    opensearch_service: OpenSearchService = Depends(get_opensearch_service)
):
    """
    Scrape data from source and load into vector database
    
    This endpoint triggers data scraping in the background
    """
    try:
        settings = get_settings()
        
        # Start scraping in background
        background_tasks.add_task(
            _scrape_and_load,
            request.source_url,
            request.source_type,
            settings,
            opensearch_service
        )
        
        return {
            "status": "started",
            "message": "Data scraping started in background",
            "source_url": request.source_url,
            "source_type": request.source_type
        }
    except Exception as e:
        logger.error(f"Error starting scrape: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/index")
async def delete_index(
    opensearch_service: OpenSearchService = Depends(get_opensearch_service)
):
    """Delete the vector database index (use with caution)"""
    try:
        opensearch_service.delete_index()
        return {"status": "success", "message": "Index deleted"}
    except Exception as e:
        logger.error(f"Error deleting index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _scrape_and_load(
    source_url: str,
    source_type: str,
    settings,
    opensearch_service: OpenSearchService
):
    """Background task to scrape and load data"""
    try:
        logger.info(f"Starting data scrape from {source_url}")
        
        # Initialize scraper
        scraper = DataScraper(settings.kaggle_username, settings.kaggle_key)
        
        # Scrape data
        records = await scraper.scrape(source_url, source_type)
        logger.info(f"Scraped {len(records)} records")
        
        # Process records and collect feature vectors
        processed_records = []
        all_feature_vectors = []
        
        for record in records:
            try:
                # ... existing feature extraction code ...
                features_dict = {}
                for k, v in record.items():
                    if k in ['Index', 'Address', 'FLAG']:
                        continue
                    try:
                        if v is None or (isinstance(v, str) and v.strip() == ''):
                            features_dict[k] = 0.0
                        else:
                            val = float(v)
                            if val != val or val == float('inf') or val == float('-inf'):
                                features_dict[k] = 0.0
                            else:
                                features_dict[k] = val
                    except (ValueError, TypeError):
                        features_dict[k] = 0.0
                
                valid_features = {k: v for k, v in features_dict.items() 
                                if k in FeatureExtractor.FEATURE_NAMES}
                
                feature_vector = FeatureExtractor.features_to_vector(valid_features)
                feature_vector = [0.0 if (x != x or x == float('inf') or x == float('-inf')) else x 
                                for x in feature_vector]
                
                all_feature_vectors.append(feature_vector)
                
                processed_records.append({
                    "address": record.get("Address", "").lower(),  # ← Ensure lowercase!
                    "flag": int(record.get("FLAG", 0)) if record.get("FLAG") not in [None, '', ' '] else 0,
                    "features": feature_vector,  # Will normalize below
                    "feature_dict": valid_features
                })
            except Exception as e:
                logger.warning(f"Error processing record: {e}")
                continue
        
        # FIT SCALER on dataset features
        logger.info("Fitting feature scaler...")
        FeatureExtractor.fit_scaler(all_feature_vectors)
        
        # NORMALIZE all feature vectors
        logger.info("Normalizing feature vectors...")
        for record in processed_records:
            record["features"] = FeatureExtractor.normalize_vector(record["features"])
        
        # Bulk insert
        logger.info(f"Inserting {len(processed_records)} records into OpenSearch")
        success, failed = opensearch_service.bulk_insert(processed_records)
        
        logger.info(f"Data load complete: {success} succeeded, {len(failed)} failed")
        
    except Exception as e:
        logger.error(f"Error in scrape and load: {e}", exc_info=True)
