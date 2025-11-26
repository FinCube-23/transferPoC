"""
Dependency injection for FastAPI routes

Provides access to global services
"""
from app.services.alchemy_service import AlchemyService
from app.services.opensearch_service import OpenSearchService
from app.services.rag_service import RAGService
from app.services.graph_services import GraphService




# Global service instances (set by main.py during startup)
_alchemy_service: AlchemyService = None
_opensearch_service: OpenSearchService = None
_rag_service: RAGService = None
_graph_service:GraphService=None


def set_services(alchemy, opensearch, rag,graph):
    """Set global service instances (called from main.py)"""
    global _alchemy_service, _opensearch_service, _rag_service,_graph_service
    _alchemy_service = alchemy
    _opensearch_service = opensearch
    _rag_service = rag
    _graph_service = graph


def get_alchemy_service() -> AlchemyService:
    """Dependency to get Alchemy service"""
    return _alchemy_service


def get_opensearch_service() -> OpenSearchService:
    """Dependency to get OpenSearch service"""
    return _opensearch_service


def get_rag_service() -> RAGService:
    """Dependency to get RAG service"""
    return _rag_service

def get_graph_service() -> GraphService:
    """Dependency to get Graph service"""
    return _graph_service
