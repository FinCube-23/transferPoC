"""
Fraud detection endpoints

Handles address scoring and fraud analysis
"""
from fastapi import APIRouter, HTTPException, Depends
import logging

from app.config import get_settings
from app.models import ScoreInfo, ScoreRequest, ScoreResponse, FraudResult, KNNResult, RAGAnalysis
from app.services.alchemy_service import AlchemyService
from app.services.opensearch_service import OpenSearchService
from app.services.knn_service import KNNService
from app.services.rag_service import RAGService
from app.utils.feature_extractor import FeatureExtractor
from app.api.deps import get_alchemy_service, get_opensearch_service, get_rag_service,get_mongodb_service
from app.services.mongodb_service import MongoDBService
from app.services.alchemy_service import convert_reference_to_bytes32

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fraud", tags=["fraud"])


@router.post("/score", response_model=ScoreResponse)
async def score_address(
    request: ScoreRequest,
    alchemy_service: AlchemyService = Depends(get_alchemy_service),
    opensearch_service: OpenSearchService = Depends(get_opensearch_service),
    rag_service: RAGService = Depends(get_rag_service),
    mongodb_service:MongoDBService=Depends(get_mongodb_service)
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
        fincube_contract_address = settings.fincube_contract_address

        reference_number = request.reference_number
        
        # don't need it as we are querying the graph directly.
        # reference_number=convert_reference_to_bytes32(reference_number)

        
        logger.info(f"Scoring address: {fincube_contract_address} with reference: {reference_number}")
        
        # Fetch account data from Alchemy
        logger.info("Fetching account data from Alchemy...")
        account_data = await alchemy_service.get_account_data(
            fincube_contract_address,
            reference_number,
        )


        logger.info(f"✅✅ Account Data: {account_data} \n \n")

        # return ScoreResponse(None)

        # Check if any transactions were found
        total_transfers = len(account_data["sent_transfers"]) + len(account_data["received_transfers"])
        if total_transfers == 0:
            logger.warning(f"No transactions found for reference {reference_number}")
            # You might want to handle this case differently
        
        logger.info(f"Found {total_transfers} filtered transactions")
        
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
            fincube_contract_address, 
            knn_analysis, 
            features,
            account_data)
        
        # Prepare response
        final_decision = FraudResult(rag_result.get("final_decision", "Undecided"))
        
        response = ScoreResponse(
            result=final_decision,
            address=fincube_contract_address,
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

        try:
            if final_decision==FraudResult.UNDECIDED:
                return response
            
            is_fraud=(final_decision==FraudResult.FRAUD)
            confidance_value=rag_result.get("confidance",knn_analysis["confidence"])

            await mongodb_service.update_score(
                user_ref_number=reference_number,
                confidance=confidance_value,
                is_fraud=is_fraud
            )
            logger.info(f"Saved score to MongoDB for reference: {reference_number}")
        except Exception as e:
            logger.error(f"Failed to save score to MongoDB: {e}")

        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scoring address: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/score/{reference_number}",response_model=ScoreInfo)
async def get_score(
    reference_number:str,
    mongodb_service:MongoDBService=Depends(get_mongodb_service)
):
    """
        Get user score by reference number
        
        Returns:
            Score information including current score and metadata
    """
    try:
        document=await mongodb_service.get_score(reference_number)
        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"No score found for reference number: {reference_number}"
            )
        
        return{
            "user_ref_number": document.get("user_ref_number"),
            "score": document.get("score", 0.0),
            "created_at": document.get("created_at").isoformat() if document.get("created_at") else None,
            "updated_at": document.get("updated_at").isoformat() if document.get("updated_at") else None,
            "last_result": document.get("last_result"),
            "last_confidence": document.get("last_confidence")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")