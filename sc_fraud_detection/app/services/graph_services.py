import httpx
from typing import Dict,List,Any,Optional
import logging

logger=logging.getLogger(__name__)

class GraphService:
    def __init__(self,subgraph_url:str):
        self.subgraph_url=subgraph_url
        self.client=httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        await self.client.aclose()

    async def get_stablecoin_transfers_by_reference(
        self,
        reference_number:str,
        first:int=1000
    ) -> List[str]:
        """
            Query subgraph for StablecoinTransfer events by reference number
            
            Args:
                reference_number: Reference number (hex string with 0x prefix)
                first: Maximum number of results (default: 1000)
            
            Returns:
                List of transaction hashes
        """

        query = """
            query GetStablecoinTransfers($senderRef: Bytes, $receiverRef: Bytes, $first: Int!) {
            senderTransfers: stablecoinTransfers(
                where: { sender_reference_number: $senderRef }
                first: $first
                orderBy: blockNumber
                orderDirection: desc
                subgraphError: allow
            ) {
                transactionHash
                sender_reference_number
                receiver_reference_number
            }
            receiverTransfers: stablecoinTransfers(
                where: { receiver_reference_number: $receiverRef }
                first: $first
                orderBy: blockNumber
                orderDirection: desc
                subgraphError: allow
            ) {
                transactionHash
                sender_reference_number
                receiver_reference_number
            }
            }
        """


        variables = {
            "senderRef": reference_number,
            "receiverRef": reference_number,
            "first": first
        }
        
        payload = {
            "query": query,
            "variables": variables
        }
        

        try:
            logger.info(f"Querying subgraph with Reference Number: {reference_number}")
            response=await self.client.post(self.subgraph_url,json=payload)
            response.raise_for_status()
            result=response.json()

            if "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
                return []

            data=result.get("data",{})

            # Combine and deduplicate transaction hashes
            tx_hashes = set()
            
            for transfer in data.get("senderTransfers", []):
                tx_hash = transfer.get("transactionHash")
                if tx_hash:
                    tx_hashes.add(tx_hash)
            
            for transfer in data.get("receiverTransfers", []):
                tx_hash = transfer.get("transactionHash")
                if tx_hash:
                    tx_hashes.add(tx_hash)
            
            logger.info(f"Found {len(tx_hashes)} unique transactions from subgraph")
            return list(tx_hashes)

        except Exception as e:
            logger.error(f"Error querying subgraph: {e}")
            return []

