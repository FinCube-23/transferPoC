from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.models import ScoreRequest, ScoreResponse, ScraperRequest, FraudResult, KNNResult, RAGAnalysis
from app.services.alchemy_service import AlchemyService
from app.services.opensearch_service import OpenSearchService
from app.services.knn_service import KNNService
from app.services.rag_service import RAGService
from app.scraper.data_scraper import DataScraper
from app.utils.feature_extractor import FeatureExtractor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global services
alchemy_service = None
opensearch_service = None
rag_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global alchemy_service, opensearch_service, rag_service
    
    settings = get_settings()
    
    # Initialize services
    logger.info("Initializing services...")
    alchemy_service = AlchemyService(settings.alchemy_api_key)
    opensearch_service = OpenSearchService(
        settings.opensearch_host,
        settings.opensearch_port,
        settings.index_name
    )
    rag_service = RAGService(settings.google_api_key)
    
    # Ensure index exists
    try:
        opensearch_service.create_index(dimension=settings.feature_dim)
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    
    logger.info("Services initialized successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down services...")
    await alchemy_service.close()


app = FastAPI(
    title="Ethereum Fraud Detection Service",
    description="RAG-based fraud detection using K-NN and Gemini",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Ethereum Fraud Detection",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/stats")
async def get_stats():
    """Get database statistics"""
    try:
        stats = opensearch_service.get_index_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scrape")
async def scrape_data(request: ScraperRequest, background_tasks: BackgroundTasks):
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
            settings
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


async def _scrape_and_load(source_url: str, source_type: str, settings):
    """Background task to scrape and load data"""
    try:
        logger.info(f"Starting data scrape from {source_url}")
        
        # Initialize scraper
        scraper = DataScraper(settings.kaggle_username, settings.kaggle_key)
        
        # Scrape data
        records = await scraper.scrape(source_url, source_type)
        logger.info(f"Scraped {len(records)} records")
        
        # Process and load into OpenSearch
        processed_records = []
        for record in records:
            try:
                # Extract features (assuming record has all feature columns)
                features_dict = {k: float(v) if v is not None else 0 for k, v in record.items() 
                                if k not in ['Index', 'Address', 'FLAG']}
                
                # Create feature vector
                feature_vector = FeatureExtractor.features_to_vector(features_dict)
                
                processed_records.append({
                    "address": record.get("Address", ""),
                    "flag": int(record.get("FLAG", 0)),
                    "features": feature_vector,
                    "feature_dict": features_dict
                })
            except Exception as e:
                logger.warning(f"Error processing record: {e}")
                continue
        
        # Bulk insert
        logger.info(f"Inserting {len(processed_records)} records into OpenSearch")
        success, failed = opensearch_service.bulk_insert(processed_records)
        
        logger.info(f"Data load complete: {success} succeeded, {len(failed)} failed")
        
    except Exception as e:
        logger.error(f"Error in scrape and load: {e}", exc_info=True)


@app.post("/score", response_model=ScoreResponse)
async def score_address(request: ScoreRequest):
    """
    Score an Ethereum address for fraud probability
    
    This endpoint:
    1. Fetches account data from Alchemy
    2. Extracts features
    3. Performs K-NN search in vector DB
    4. Uses RAG (Gemini) for final analysis
    5. Returns fraud determination
    """
    try:
        settings = get_settings()
        address = request.address.lower()
        
        logger.info(f"Scoring address: {address}")
        
        # Step 1: Fetch account data from Alchemy
        logger.info("Fetching account data from Alchemy...")
        account_data = await alchemy_service.get_account_data(address)
        
        # Step 2: Extract features
        logger.info("Extracting features...")
        features = FeatureExtractor.extract_features(account_data)
        feature_vector = FeatureExtractor.features_to_vector(features)
        
        # Step 3: K-NN search
        logger.info("Performing K-NN search...")
        neighbors = opensearch_service.knn_search(feature_vector, k=settings.knn_neighbors)
        
        if not neighbors:
            raise HTTPException(
                status_code=503,
                detail="No data in vector database. Please run /scrape first."
            )
        
        # Step 4: Analyze K-NN results
        logger.info("Analyzing K-NN results...")
        knn_analysis = KNNService.analyze_neighbors(neighbors)
        
        # Step 5: RAG analysis with Gemini
        logger.info("Running RAG analysis...")
        rag_result = await rag_service.analyze(address, knn_analysis, features)
        
        # Step 6: Prepare response
        final_decision = FraudResult(rag_result.get("final_decision", "Undecided"))
        
        response = ScoreResponse(
            result=final_decision,
            address=address,
            fraud_probability=knn_analysis["fraud_probability"],
            confidence=rag_result.get("confidence", knn_analysis["confidence"]),
            knn_analysis=KNNResult(
                fraud_probability=knn_analysis["fraud_probability"],
                nearest_neighbors=[
                    {
                        "address": n.get("address", ""),
                        "flag": n.get("flag", 0),
                        "distance": n.get("distance", 0)
                    }
                    for n in neighbors[:5]  # Top 5 for response
                ],
                avg_distance=knn_analysis["avg_distance"]
            ),
            rag_analysis=RAGAnalysis(
                reasoning=rag_result.get("reasoning", ""),
                confidence=rag_result.get("confidence", 0),
                edge_cases_detected=rag_result.get("edge_cases_detected", [])
            ),
            features_extracted=features
        )
        
        logger.info(f"Scoring complete: {final_decision}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scoring address: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.delete("/index")
async def delete_index():
    """Delete the vector database index (use with caution)"""
    try:
        opensearch_service.delete_index()
        return {"status": "success", "message": "Index deleted"}
    except Exception as e:
        logger.error(f"Error deleting index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
