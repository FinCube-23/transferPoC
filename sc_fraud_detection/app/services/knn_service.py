from typing import List, Dict, Any
import numpy as np
import logging

logger = logging.getLogger(__name__)


class KNNService:
    """Service for K-NN analysis and fraud probability calculation"""
    
    @staticmethod
    def analyze_neighbors(neighbors: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze K-NN results to determine fraud probability
        
        Args:
            neighbors: List of nearest neighbors from OpenSearch
        
        Returns:
            Analysis results with fraud probability
        """
        if not neighbors:
            return {
                "fraud_probability": 0.5,
                "fraud_count": 0,
                "total_count": 0,
                "avg_distance": 0,
                "confidence": 0
            }
        
        # Count fraud vs non-fraud
        fraud_count = sum(1 for n in neighbors if n.get("flag") == 1)
        total_count = len(neighbors)
        
        # Calculate weighted fraud probability based on distance
        distances = [n.get("distance", 1) for n in neighbors]
        flags = [n.get("flag", 0) for n in neighbors]
        
        # Inverse distance weighting(a closer neighbor gets more importance than distant neighbors)
        weights = [1 / (d + 1e-6) for d in distances]
        total_weight = sum(weights)
        
        # ref: Dudani (1976) "The Distance-Weighted k-Nearest-Neighbor Rule"
        weighted_fraud_prob = sum(
            w * flag for w, flag in zip(weights, flags)
        ) / total_weight if total_weight > 0 else 0
        
        # Simple probability
        simple_fraud_prob = fraud_count / total_count
        
        # Average distance (lower = more confident)
        avg_distance = np.mean(distances)
        
        # Confidence based on distance and agreement
        # Lower distance = higher confidence
        # Higher agreement = higher confidence
        distance_confidence = 1 / (1 + avg_distance)
        agreement = max(fraud_count, total_count - fraud_count) / total_count
        confidence = (distance_confidence + agreement) / 2
        
        return {
            "fraud_probability": weighted_fraud_prob,
            "simple_fraud_probability": simple_fraud_prob,
            "fraud_count": fraud_count,
            "non_fraud_count": total_count - fraud_count,
            "total_count": total_count,
            "avg_distance": float(avg_distance),
            "confidence": float(confidence),
            "nearest_neighbors": neighbors
        }
    
    
