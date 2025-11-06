import httpx
from typing import Dict, List, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class AlchemyService:
    """Service to interact with Alchemy API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = f"https://eth-sepolia.g.alchemy.com/v2/{api_key}"
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        await self.client.aclose()
    
    async def _make_request(self, method: str, params: List[Any]) -> Dict:
        """Make JSON-RPC request to Alchemy"""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }
        
        response = await self.client.post(self.base_url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        if "error" in result:
            raise Exception(f"Alchemy API error: {result['error']}")
        
        return result.get("result", {})
    
    async def get_asset_transfers_sent(self, address: str, max_count: int = 1000) -> List[Dict]:
        """Get all asset transfers sent from address"""
        params = [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "fromAddress": address,
            "category": ["external", "internal", "erc20", "erc721", "erc1155"],
            "withMetadata": True,
            "excludeZeroValue": False,
            "maxCount": hex(max_count)
        }]
        
        result = await self._make_request("alchemy_getAssetTransfers", params)
        return result.get("transfers", [])
    
    async def get_asset_transfers_received(self, address: str, max_count: int = 1000) -> List[Dict]:
        """Get all asset transfers received by address"""
        params = [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "toAddress": address,
            "category": ["external", "internal", "erc20", "erc721", "erc1155"],
            "withMetadata": True,
            "excludeZeroValue": False,
            "maxCount": hex(max_count)
        }]
        
        result = await self._make_request("alchemy_getAssetTransfers", params)
        return result.get("transfers", [])
    
    async def get_balance(self, address: str) -> float:
        """Get current Ether balance"""
        result = await self._make_request("eth_getBalance", [address, "latest"])
        # Convert from Wei to Ether
        return int(result, 16) / 1e18
    
    async def get_transaction_count(self, address: str) -> int:
        """Get transaction count (nonce)"""
        result = await self._make_request("eth_getTransactionCount", [address, "latest"])
        return int(result, 16)
    
    async def get_token_balances(self, address: str) -> Dict:
        """Get ERC20 token balances"""
        result = await self._make_request("alchemy_getTokenBalances", [address, "erc20"])
        return result
    
    async def get_account_data(self, address: str) -> Dict[str, Any]:
        """
        Get comprehensive account data
        
        Returns all data needed for feature extraction
        """
        logger.info(f"Fetching account data for {address}")
        
        # Fetch all data in parallel would be ideal, but for simplicity doing sequential
        sent_transfers = await self.get_asset_transfers_sent(address)
        received_transfers = await self.get_asset_transfers_received(address)
        balance = await self.get_balance(address)
        tx_count = await self.get_transaction_count(address)
        token_balances = await self.get_token_balances(address)
        
        return {
            "address": address,
            "sent_transfers": sent_transfers,
            "received_transfers": received_transfers,
            "balance": balance,
            "tx_count": tx_count,
            "token_balances": token_balances,
            "fetched_at": datetime.utcnow().isoformat()
        }
