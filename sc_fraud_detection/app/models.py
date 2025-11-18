from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class FraudResult(str, Enum):
    FRAUD = "Fraud"
    NOT_FRAUD = "Not_Fraud"
    UNDECIDED = "Undecided"


class ScoreRequest(BaseModel):
    address: str = Field(..., description="Ethereum address to check")


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


