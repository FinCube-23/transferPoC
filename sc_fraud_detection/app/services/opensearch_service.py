from opensearchpy import OpenSearch, helpers
from typing import List, Dict, Any
import logging
import numpy as np

logger = logging.getLogger(__name__)


class OpenSearchService:
    """Service for OpenSearch vector database operations"""
    
    def __init__(self, host: str, port: int, index_name: str):
        self.client = OpenSearch(
            hosts=[{"host": host, "port": port}],
            http_compress=True,
            use_ssl=False,
            verify_certs=False,
            ssl_assert_hostname=False,
            ssl_show_warn=False
        )
        self.index_name = index_name
    
    def create_index(self, dimension: int = 44):
        """Create index with k-NN configuration"""
        if self.client.indices.exists(index=self.index_name):
            logger.info(f"Index {self.index_name} already exists")
            return
        
        # Create the index with the K-NN configuration
        index_body = {
            "settings": {
                "index": {
                    "knn": True,
                    "knn.algo_param.ef_search": 100,
                    "number_of_shards": 1,
                    "number_of_replicas": 0
                }
            },
            "mappings": {
                "properties": {
                    "address": {"type": "keyword"},
                    "flag": {"type": "integer"},
                    "features": {
                        "type": "knn_vector",
                        "dimension": dimension,
                        "method": {
                            "name": "hnsw",
                            "space_type": "l2",
                            "engine": "nmslib",
                            "parameters": {
                                "ef_construction": 128,
                                "m": 24
                            }
                        }
                    },
                    "feature_dict": {"type": "object", "enabled": False}
                }
            }
        }
        
        self.client.indices.create(index=self.index_name, body=index_body)
        logger.info(f"Created index {self.index_name}")
    
    def bulk_insert(self, records: List[Dict[str, Any]], batch_size: int = 500):
        """
        Bulk insert records into OpenSearch
        
        Args:
            records: List of dicts with 'address', 'flag', 'features' (vector), 'feature_dict'
            batch_size: Number of records per batch
        """
        def generate_actions():
            for record in records:
                yield {
                    "_index": self.index_name,
                    "_source": record
                }
        
        success_count = 0
        failed_items = []
        
        for ok, item in helpers.streaming_bulk(
            self.client,
            generate_actions(),
            chunk_size=batch_size,
            raise_on_error=False
        ):
            if ok:
                success_count += 1
            else:
                failed_items.append(item)
                # Log first 3 errors for debugging
                if len(failed_items) <= 3:
                    logger.error(f"Failed to insert document: {item}")
        
        logger.info(f"Bulk insert: {success_count} succeeded, {len(failed_items)} failed")
        
        if failed_items:
            logger.error(f"Sample failure reasons from first error: {failed_items[0] if failed_items else 'none'}")
        
        return success_count, failed_items
    
    def knn_search(self, query_vector: List[float], k: int = 10) -> List[Dict[str, Any]]:
        """
        Perform k-NN search
        
        Args:
            query_vector: Feature vector to search for
            k: Number of nearest neighbors
        
        Returns:
            List of nearest neighbors with scores
        """
        query = {
            "size": k,
            "query": {
                "knn": {
                    "features": {
                        "vector": query_vector,
                        "k": k
                    }
                }
            }
        }
        # This will perform the k-NN similarity search and return the nearest neighbors
        # Vector DB have K-NN Search built in, so we can use it to search for the nearest neighbors.
        response = self.client.search(index=self.index_name, body=query)
        
        results = []
        for hit in response["hits"]["hits"]:
            results.append({
                "address": hit["_source"].get("address"),
                "flag": hit["_source"].get("flag"),
                "score": hit["_score"],
                "distance": 1 / (1 + hit["_score"]),  # Convert score to distance
                "features": hit["_source"].get("feature_dict", {})
            })
        
        return results
    
    def get_index_stats(self) -> Dict[str, Any]:
        """Get index statistics"""
        if not self.client.indices.exists(index=self.index_name):
            return {"exists": False}
        
        stats = self.client.indices.stats(index=self.index_name)
        count = self.client.count(index=self.index_name)
        
        return {
            "exists": True,
            "document_count": count["count"],
            "size_in_bytes": stats["_all"]["total"]["store"]["size_in_bytes"]
        }
    
    def delete_index(self):
        """Delete the index"""
        if self.client.indices.exists(index=self.index_name):
            self.client.indices.delete(index=self.index_name)
            logger.info(f"Deleted index {self.index_name}")
