"""
Fraud detection endpoints

Handles address scoring and fraud analysis
"""
from fastapi import APIRouter, HTTPException, Depends
import logging

from app.config import get_settings
from app.models import ScoreRequest, ScoreResponse, FraudResult, KNNResult, RAGAnalysis
from app.services.alchemy_service import AlchemyService
from app.services.opensearch_service import OpenSearchService
from app.services.knn_service import KNNService
from app.services.rag_service import RAGService
from app.utils.feature_extractor import FeatureExtractor
from app.api.deps import get_alchemy_service, get_opensearch_service, get_rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fraud", tags=["fraud"])


@router.post("/score", response_model=ScoreResponse)
async def score_address(
    request: ScoreRequest,
    alchemy_service: AlchemyService = Depends(get_alchemy_service),
    opensearch_service: OpenSearchService = Depends(get_opensearch_service),
    rag_service: RAGService = Depends(get_rag_service)
):
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
        
        # Fetch account data from Alchemy
        logger.info("Fetching account data from Alchemy...")
        account_data = await alchemy_service.get_account_data(address)

        # print(f"✅✅ Account Data : {account_data}")
        
        # Extract features
        logger.info("Extracting features...")
        features = FeatureExtractor.extract_features(account_data)
        feature_vector = FeatureExtractor.features_to_vector(features)
        # print(f"⚠️⚠️ Features Vector : {feature_vector}")

        # NORMALIZE the query vector
        feature_vector = FeatureExtractor.normalize_vector(feature_vector)
        
        # K-NN search
        logger.info("Performing K-NN search...")
        neighbors = opensearch_service.knn_search(feature_vector, k=settings.knn_neighbors)
        
        if not neighbors:
            raise HTTPException(
                status_code=503,
                detail="No data in vector database. Please run /data/scrape first."
            )
        
        # Analyze K-NN results
        logger.info("Analyzing K-NN results...")
        knn_analysis = KNNService.analyze_neighbors(neighbors)
        
        # RAG analysis with Gemini
        logger.info("Running RAG analysis...")
        rag_result = await rag_service.analyze(
            address, 
            knn_analysis, 
            features,
            account_data)
        
        # Prepare response
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
