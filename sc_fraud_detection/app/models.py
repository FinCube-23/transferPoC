from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class FraudResult(str, Enum):
    FRAUD = "Fraud"
    NOT_FRAUD = "Not_Fraud"
    UNDECIDED = "Undecided"


class ScoreRequest(BaseModel):
    reference_number: str = Field(..., description="Reference number to filter transactions")


class KNNResult(BaseModel):
    fraud_probability: float
    nearest_neighbors: List[Dict[str, Any]]
    avg_distance: float


class RAGAnalysis(BaseModel):
    reasoning: str
    confidence: float
    edge_cases_detected: List[str]


class ScoreResponse(BaseModel):
    result: FraudResult
    address: str
    fraud_probability: float
    confidence: float
    knn_analysis: KNNResult
    rag_analysis: RAGAnalysis
    features_extracted: Dict[str, float]


class ScoreInfo(BaseModel):
    user_ref_number: str
    score: float
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_result: Optional[str] = None
    last_confidence: Optional[float] = None