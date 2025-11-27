import httpx
from typing import Dict, List, Any,Set,Optional
import logging
from datetime import datetime
from app.services.graph_services import GraphService
from web3 import Web3
from eth_abi import decode as abi_decode



logger = logging.getLogger(__name__)



STABLECOIN_TRANSFER_EVENT_HASH = Web3.keccak(
    text="StablecoinTransfer(bytes32,bytes32,string,address,address,string,uint256,bytes32)"
).hex()


def convert_reference_to_bytes32(reference_number: str) -> str:
    """
    Convert plain text reference to bytes32 (keccak256 hash)
    """
    hash_bytes = Web3.keccak(text=reference_number)
    return hash_bytes.hex()

class AlchemyService:
    """Service to interact with Alchemy API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = f"https://celo-sepolia.g.alchemy.com/v2/{api_key}"
        # Use Celo public RPC for eth_getLogs (Alchemy doesn't support it well on Celo)
        self.celo_rpc_url =f"https://celo-sepolia.g.alchemy.com/v2/{api_key}"
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

        if method == "eth_getLogs":
            url = self.celo_rpc_url
            logger.info(f"Using Celo public RPC for {method}")
        else:
            url = self.base_url
        
        response = await self.client.post(url, json=payload)
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
            "category": ["external", "erc20", "erc721", "erc1155"],
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
            "category": ["external", "erc20", "erc721", "erc1155"],
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
    
    async def get_stablecoin_transfer_logs_by_reference(
        self,
        reference_number:str,
        graph_service:Optional[GraphService]=None
    )-> List[Dict]:
        """
        Get StablecoinTransfer event logs filtered by reference number
        
        More efficient than fetching all logs and filtering locally.
        Uses topic filters to let Alchemy do the filtering.
        
        Event: StablecoinTransfer(
            bytes32 indexed sender_reference_number,
            bytes32 indexed receiver_reference_number,
            string indexed memoHash,
            address from,
            address to,
            string memo,
            uint256 amount,
            bytes32 nullifier
        )
        
        Args:
            fincube_contract_address: FinCube contract address
            reference_number: Reference number to filter by (hex string)
            from_block: Starting block (default: "0x0")
            to_block: Ending block (default: "latest")
        
        Returns:
            List of event logs matching the reference number
        """
        # Get graph service inside method to avoid circular import
        if graph_service is None:
            from app.api.deps import get_graph_service
            graph_service = get_graph_service()

        if graph_service is None:
            logger.error("Graph service not available")
            return []

        logger.info("Using graph serivce to find Transactions.")
        tx_hashes=await graph_service.get_stablecoin_transfers_by_reference(reference_number)

        return [{"transactionHash":tx_hash} for tx_hash in tx_hashes]

    

    async def extract_transaction_hashes_from_logs(
        self,
        event_logs:List[Dict],
        address:str
    ) -> Set[str]:
        """
        Extract transaction hashes from event logs, verifying address matches
        
        Args:
            event_logs: List of StablecoinTransfer event logs
            address: Wallet address to verify against
        
        Returns:
            Set of transaction hashes where address is involved
        """
        matching_tx_hashes = set()
    
        for log in event_logs:
            tx_hash = log.get("transactionHash")
            if tx_hash:
                matching_tx_hashes.add(tx_hash)
        
        return matching_tx_hashes


    async def filter_transfers_by_tx_hashes(
        self,
        transfers: List[Dict],
        tx_hashes: Set[str]
    ) -> List[Dict]:
        """
        Filter transfers to keep only those with matching transaction hashes
        
        Args:
            transfers: List of transfers from Alchemy
            tx_hashes: Set of transaction hashes to keep
        
        Returns:
            Filtered list of transfers
        """
        filtered=[
            transfer for transfer in transfers if transfer.get("hash") in tx_hashes
        ]
        return filtered
        



    async def get_account_data(
        self, 
        fincube_contract_address: str,
        reference_number:str,
    ) -> Dict[str, Any]:
        """
        Get account data filtered by reference_number
        
        This is the main method that orchestrates the filtering workflow:
        1. Fetch all transaction data from Alchemy
        2. Fetch event logs filtered by reference_number
        3. Extract matching transaction hashes
        4. Filter transfers to keep only matching ones
        
        Args:
            address: Wallet address
            reference_number: Reference number (hex string with or without 0x prefix)
            fincube_contract_address: FinCube contract address
        
        Returns:
            Account data with filtered transfers
        """
        logger.info(f"Fetching filtered account data for {fincube_contract_address} with reference {reference_number}")

        # Fetch all data in parallel
        sent_transfers = await self.get_asset_transfers_sent(fincube_contract_address)
        received_transfers = await self.get_asset_transfers_received(fincube_contract_address)
        balance = await self.get_balance(fincube_contract_address)
        tx_count = await self.get_transaction_count(fincube_contract_address)
        token_balances = await self.get_token_balances(fincube_contract_address)
        
        logger.info(f"Fetched {len(sent_transfers)} sent and {len(received_transfers)} received transfers")


        from app.api.deps import get_graph_service
        graph_service_instance = get_graph_service()
        # Fetch event logs filtered by reference number.
        event_logs=await self.get_stablecoin_transfer_logs_by_reference(
            reference_number,
            graph_service=graph_service_instance
        )

        # Extract tx hashes from event-logs
        matching_tx_hashes=await self.extract_transaction_hashes_from_logs(
            event_logs,
            fincube_contract_address
        )

        logger.info(f"Found {len(matching_tx_hashes)} matching transactions")

        # Filter transfers by transactions hashes.
        filtered_sent=await self.filter_transfers_by_tx_hashes(
            sent_transfers,
            matching_tx_hashes
        )

        filtered_received=await self.filter_transfers_by_tx_hashes(
            received_transfers,
            matching_tx_hashes
        )

        logger.info(f"Filtered to {len(filtered_sent)} sent and {len(filtered_received)} received transfers")


        return {
            "address": fincube_contract_address,
            "sent_transfers": filtered_sent,
            "received_transfers": filtered_received,
            "balance": balance,
            "tx_count": tx_count,
            "token_balances": token_balances,
            "fetched_at": datetime.utcnow().isoformat(),
            "reference_number": reference_number,
            "filtered": True,
            "total_matching_events": len(event_logs)
        }
    




        
