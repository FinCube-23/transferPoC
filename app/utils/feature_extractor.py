from typing import Dict, List, Any
import numpy as np
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FeatureExtractor:
    """Extract features from Alchemy account data matching Kaggle dataset format"""
    
    FEATURE_NAMES = [
        "Avg min between sent tnx",
        "Avg min between received tnx",
        "Time Diff between first and last (Mins)",
        "Sent tnx",
        "Received Tnx",
        "Number of Created Contracts",
        "Unique Received From Addresses",
        "Unique Sent To Addresses",
        "min value received",
        "max value received",
        "avg val received",
        "min val sent",
        "max val sent",
        "avg val sent",
        "min value sent to contract",
        "max val sent to contract",
        "avg value sent to contract",
        "total transactions (including tnx to create contract)",
        "total Ether sent",
        "total ether received",
        "total ether sent contracts",
        "total ether balance",
        " Total ERC20 tnxs",
        " ERC20 total Ether received",
        " ERC20 total ether sent",
        " ERC20 total Ether sent contract",
        " ERC20 uniq sent addr",
        " ERC20 uniq rec addr",
        " ERC20 uniq rec contract addr",
        " ERC20 avg time between sent tnx",
        " ERC20 avg time between rec tnx",
        " ERC20 avg time between contract tnx",
        " ERC20 min val rec",
        " ERC20 max val rec",
        " ERC20 avg val rec",
        " ERC20 min val sent",
        " ERC20 max val sent",
        " ERC20 avg val sent",
        " ERC20 uniq sent token name",
        " ERC20 uniq rec token name",
        " ERC20 most sent token type",
        " ERC20 most rec token type",
        "Unique Sent To Addresses",
        "Unique Received From Addresses"
    ]
    
    @staticmethod
    def extract_features(account_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract all features from account data
        
        Args:
            account_data: Data from AlchemyService.get_account_data()
        
        Returns:
            Dictionary of feature name -> value
        """
        sent = account_data["sent_transfers"]
        received = account_data["received_transfers"]
        
        # Filter by category
        sent_external = [t for t in sent if t.get("category") == "external"]
        received_external = [t for t in received if t.get("category") == "external"]
        sent_erc20 = [t for t in sent if t.get("category") == "erc20"]
        received_erc20 = [t for t in received if t.get("category") == "erc20"]
        
        features = {}
        
        # Transaction counts
        features["Sent tnx"] = len(sent_external)
        features["Received Tnx"] = len(received_external)
        features[" Total ERC20 tnxs"] = len(sent_erc20) + len(received_erc20)
        features["total transactions (including tnx to create contract)"] = len(sent) + len(received)
        
        # Timing features
        features["Avg min between sent tnx"] = FeatureExtractor._calc_avg_time_diff(sent_external)
        features["Avg min between received tnx"] = FeatureExtractor._calc_avg_time_diff(received_external)
        features["Time Diff between first and last (Mins)"] = FeatureExtractor._calc_time_range(sent + received)
        
        # Value features - sent
        sent_values = [float(t.get("value", 0)) for t in sent_external if t.get("value")]
        features["min val sent"] = min(sent_values) if sent_values else 0
        features["max val sent"] = max(sent_values) if sent_values else 0
        features["avg val sent"] = np.mean(sent_values) if sent_values else 0
        features["total Ether sent"] = sum(sent_values)
        
        # Value features - received
        received_values = [float(t.get("value", 0)) for t in received_external if t.get("value")]
        features["min value received"] = min(received_values) if received_values else 0
        features["max value received"] = max(received_values) if received_values else 0
        features["avg val received"] = np.mean(received_values) if received_values else 0
        features["total ether received"] = sum(received_values)
        
        # Contract interactions
        contract_txs = [t for t in sent if FeatureExtractor._is_contract_tx(t)]
        contract_values = [float(t.get("value", 0)) for t in contract_txs if t.get("value")]
        features["Number of Created Contracts"] = len([t for t in sent if t.get("category") == "internal"])
        features["min value sent to contract"] = min(contract_values) if contract_values else 0
        features["max val sent to contract"] = max(contract_values) if contract_values else 0
        features["avg value sent to contract"] = np.mean(contract_values) if contract_values else 0
        features["total ether sent contracts"] = sum(contract_values)
        
        # Unique addresses
        features["Unique Sent To Addresses"] = len(set([t.get("to", "") for t in sent if t.get("to")]))
        features["Unique Received From Addresses"] = len(set([t.get("from", "") for t in received if t.get("from")]))
        features["Unique Sent To Addresses"] = features["Unique Sent To Addresses"]  # Duplicate in dataset
        features["Unique Received From Addresses"] = features["Unique Received From Addresses"]  # Duplicate
        
        # Balance
        features["total ether balance"] = account_data["balance"]
        
        # ERC20 features
        erc20_sent_values = [float(t.get("value", 0)) for t in sent_erc20 if t.get("value")]
        erc20_received_values = [float(t.get("value", 0)) for t in received_erc20 if t.get("value")]
        
        features[" ERC20 total ether sent"] = sum(erc20_sent_values)
        features[" ERC20 total Ether received"] = sum(erc20_received_values)
        features[" ERC20 min val sent"] = min(erc20_sent_values) if erc20_sent_values else 0
        features[" ERC20 max val sent"] = max(erc20_sent_values) if erc20_sent_values else 0
        features[" ERC20 avg val sent"] = np.mean(erc20_sent_values) if erc20_sent_values else 0
        features[" ERC20 min val rec"] = min(erc20_received_values) if erc20_received_values else 0
        features[" ERC20 max val rec"] = max(erc20_received_values) if erc20_received_values else 0
        features[" ERC20 avg val rec"] = np.mean(erc20_received_values) if erc20_received_values else 0
        
        # ERC20 unique addresses
        features[" ERC20 uniq sent addr"] = len(set([t.get("to", "") for t in sent_erc20 if t.get("to")]))
        features[" ERC20 uniq rec addr"] = len(set([t.get("from", "") for t in received_erc20 if t.get("from")]))
        
        # ERC20 contract interactions
        erc20_contract_txs = [t for t in sent_erc20 if FeatureExtractor._is_contract_tx(t)]
        erc20_contract_values = [float(t.get("value", 0)) for t in erc20_contract_txs if t.get("value")]
        features[" ERC20 total Ether sent contract"] = sum(erc20_contract_values)
        features[" ERC20 uniq rec contract addr"] = len(set([t.get("to", "") for t in erc20_contract_txs if t.get("to")]))
        
        # ERC20 timing
        features[" ERC20 avg time between sent tnx"] = FeatureExtractor._calc_avg_time_diff(sent_erc20)
        features[" ERC20 avg time between rec tnx"] = FeatureExtractor._calc_avg_time_diff(received_erc20)
        features[" ERC20 avg time between contract tnx"] = FeatureExtractor._calc_avg_time_diff(erc20_contract_txs)
        
        # ERC20 token types
        sent_tokens = [t.get("rawContract", {}).get("address") for t in sent_erc20 if t.get("rawContract")]
        received_tokens = [t.get("rawContract", {}).get("address") for t in received_erc20 if t.get("rawContract")]
        
        features[" ERC20 uniq sent token name"] = len(set(sent_tokens))
        features[" ERC20 uniq rec token name"] = len(set(received_tokens))
        
        # Most common tokens (using count as proxy)
        features[" ERC20 most sent token type"] = FeatureExtractor._most_common(sent_tokens)
        features[" ERC20 most rec token type"] = FeatureExtractor._most_common(received_tokens)
        
        return features
    
    @staticmethod
    def _calc_avg_time_diff(transactions: List[Dict]) -> float:
        """Calculate average time difference between transactions in minutes"""
        if len(transactions) < 2:
            return 0
        
        timestamps = []
        for tx in transactions:
            metadata = tx.get("metadata", {})
            block_timestamp = metadata.get("blockTimestamp")
            if block_timestamp:
                try:
                    dt = datetime.fromisoformat(block_timestamp.replace("Z", "+00:00"))
                    timestamps.append(dt.timestamp())
                except:
                    continue
        
        if len(timestamps) < 2:
            return 0
        
        timestamps.sort()
        diffs = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
        avg_seconds = np.mean(diffs)
        return avg_seconds / 60  # Convert to minutes
    
    @staticmethod
    def _calc_time_range(transactions: List[Dict]) -> float:
        """Calculate time difference between first and last transaction in minutes"""
        if len(transactions) < 2:
            return 0
        
        timestamps = []
        for tx in transactions:
            metadata = tx.get("metadata", {})
            block_timestamp = metadata.get("blockTimestamp")
            if block_timestamp:
                try:
                    dt = datetime.fromisoformat(block_timestamp.replace("Z", "+00:00"))
                    timestamps.append(dt.timestamp())
                except:
                    continue
        
        if len(timestamps) < 2:
            return 0
        
        return (max(timestamps) - min(timestamps)) / 60  # Minutes
    
    @staticmethod
    def _is_contract_tx(tx: Dict) -> bool:
        """Check if transaction is to a contract"""
        # Heuristic: if it has a rawContract field or category is internal
        return tx.get("rawContract") is not None or tx.get("category") == "internal"
    
    @staticmethod
    def _most_common(items: List) -> float:
        """Return count of most common item (as numeric feature)"""
        if not items:
            return 0
        from collections import Counter
        counter = Counter(items)
        return counter.most_common(1)[0][1] if counter else 0
    
    @staticmethod
    def features_to_vector(features: Dict[str, float]) -> List[float]:
        """Convert features dict to ordered vector"""
        # Use a consistent ordering based on FEATURE_NAMES
        vector = []
        for name in FeatureExtractor.FEATURE_NAMES:
            vector.append(features.get(name, 0))
        return vector
