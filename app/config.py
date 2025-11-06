from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API Keys
    alchemy_api_key: str
    google_api_key: str
    
    # Kaggle
    kaggle_username: str = ""
    kaggle_key: str = ""
    
    # OpenSearch
    opensearch_host: str = "opensearch"
    opensearch_port: int = 9200
    index_name: str = "fraud_detection_vectors"
    
    # K-NN Config
    knn_neighbors: int = 10
    confidence_threshold: float = 0.7
    
    # Feature dimensions (based on dataset)
    feature_dim: int = 44
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
