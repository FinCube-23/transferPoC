from typing import Dict, Any, List, Optional, Tuple
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph
from pydantic import BaseModel, Field
import logging
import json
import numpy as np
from datetime import datetime, timedelta
from collections import Counter, defaultdict

logger = logging.getLogger(__name__)


class RAGOutput(BaseModel):
    """Structured output from RAG analysis"""
    final_decision: str = Field(description="Final fraud decision: Fraud, Not_Fraud, or Undecided")
    reasoning: str = Field(description="Detailed reasoning for the decision")
    confidence: float = Field(description="Confidence score 0-1")
    edge_cases_detected: List[str] = Field(description="List of edge cases or anomalies detected")
    risk_factors: List[str] = Field(description="Specific risk factors identified")
    validation_checks: Dict[str, Any] = Field(default_factory=dict, description="Results of validation checks")
    behavioral_score: float = Field(default=0.0, description="Behavioral analysis score 0-1")


class AlchemyPatternAnalyzer:
    """Advanced pattern analyzer for Alchemy transaction data"""
    
    @staticmethod
    def analyze_transaction_patterns(account_data: Dict[str, Any]) -> Dict[str, Any]:
        """Deep analysis of transaction patterns from Alchemy data"""
        sent_transfers = account_data.get("sent_transfers", [])
        received_transfers = account_data.get("received_transfers", [])
        
        patterns = {
            "temporal_patterns": AlchemyPatternAnalyzer._analyze_temporal_patterns(
                sent_transfers, received_transfers
            ),
            "value_patterns": AlchemyPatternAnalyzer._analyze_value_patterns(
                sent_transfers, received_transfers
            ),
            "network_patterns": AlchemyPatternAnalyzer._analyze_network_patterns(
                sent_transfers, received_transfers
            ),
            "token_patterns": AlchemyPatternAnalyzer._analyze_token_patterns(
                sent_transfers, received_transfers
            ),
            "behavioral_flags": AlchemyPatternAnalyzer._detect_behavioral_flags(
                sent_transfers, received_transfers, account_data
            )
        }
        
        # Calculate overall risk score
        patterns["risk_score"] = AlchemyPatternAnalyzer._calculate_risk_score(patterns)
        
        return patterns
    
    @staticmethod
    def _analyze_temporal_patterns(sent: List[Dict], received: List[Dict]) -> Dict[str, Any]:
        """Analyze timing patterns in transactions"""
        all_txs = sent + received
        if not all_txs:
            return {"patterns": [], "risk_level": 0}
        
        timestamps = []
        for tx in all_txs:
            if tx is None:
                continue
            metadata = tx.get("metadata")
            if metadata and isinstance(metadata, dict) and metadata.get("blockTimestamp"):
                try:
                    dt = datetime.fromisoformat(metadata["blockTimestamp"].replace("Z", "+00:00"))
                    timestamps.append(dt.timestamp())
                except:
                    continue
        
        if len(timestamps) < 2:
            return {"patterns": [], "risk_level": 0}
        
        timestamps.sort()
        time_diffs = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
        
        patterns = []
        risk_level = 0
        
        # Pattern 1: Burst activity (many txs in short time)
        burst_count = sum(1 for diff in time_diffs if diff < 60)  # < 1 minute apart
        if burst_count >= 5:
            patterns.append("burst_activity_detected")
            risk_level += 0.3
        
        # Pattern 2: Regular interval activity (bot-like)
        if len(time_diffs) >= 10:
            std_dev = np.std(time_diffs)
            mean_diff = np.mean(time_diffs)
            if std_dev < mean_diff * 0.1 and mean_diff < 3600:  # Very regular, under 1hr intervals
                patterns.append("regular_interval_activity")
                risk_level += 0.2
        
        # Pattern 3: Night-time activity (suspicious for certain regions)
        night_txs = 0
        for ts in timestamps:
            hour = datetime.fromtimestamp(ts).hour
            if 1 <= hour <= 5:  # 1 AM - 5 AM UTC
                night_txs += 1
        if len(timestamps) > 0 and (night_txs / len(timestamps)) > 0.7:
            patterns.append("predominantly_night_activity")
            risk_level += 0.1
        
        # Pattern 4: Short lifespan with high activity
        if timestamps:
            lifespan_hours = (timestamps[-1] - timestamps[0]) / 3600
            if lifespan_hours < 24 and len(timestamps) > 50:
                patterns.append("high_activity_short_lifespan")
                risk_level += 0.4
        
        return {
            "patterns": patterns,
            "risk_level": min(risk_level, 1.0),
            "burst_count": burst_count,
            "avg_time_between_tx": np.mean(time_diffs) if time_diffs else 0,
            "total_lifespan_hours": (timestamps[-1] - timestamps[0]) / 3600 if len(timestamps) > 1 else 0
        }
    
    @staticmethod
    def _analyze_value_patterns(sent: List[Dict], received: List[Dict]) -> Dict[str, Any]:
        """Analyze value transfer patterns"""
        sent_values = []
        for tx in sent:
            if tx is not None and tx.get("value") is not None:
                try:
                    sent_values.append(float(tx.get("value", 0)))
                except (ValueError, TypeError):
                    pass
        
        received_values = []
        for tx in received:
            if tx is not None and tx.get("value") is not None:
                try:
                    received_values.append(float(tx.get("value", 0)))
                except (ValueError, TypeError):
                    pass
        
        patterns = []
        risk_level = 0
        
        # Pattern 1: Round number transactions (common in fraud/money laundering)
        round_numbers = [0.1, 0.5, 1.0, 5.0, 10.0, 50.0, 100.0, 1000.0]
        round_count = sum(1 for val in sent_values + received_values 
                         if any(abs(val - rn) < 0.001 for rn in round_numbers))
        if len(sent_values + received_values) > 0:
            round_ratio = round_count / len(sent_values + received_values)
            if round_ratio > 0.5:
                patterns.append("frequent_round_values")
                risk_level += 0.3
        
        # Pattern 2: Matching send/receive values (wash trading indicator)
        if sent_values and received_values:
            for sv in sent_values[-20:]:  # Check last 20
                for rv in received_values[-20:]:
                    if abs(sv - rv) < 0.01 and sv > 0:
                        patterns.append("matching_send_receive_values")
                        risk_level += 0.4
                        break
                if "matching_send_receive_values" in patterns:
                    break
        
        # Pattern 3: Rapid value accumulation and dispersal (mixing behavior)
        if sent_values and received_values:
            total_received = sum(received_values)
            total_sent = sum(sent_values)
            if total_received > 10 and total_sent > 10:
                ratio = min(total_sent, total_received) / max(total_sent, total_received)
                if ratio > 0.9 and len(sent_values) > 20:  # Nearly equal in/out with high volume
                    patterns.append("mixer_value_pattern")
                    risk_level += 0.5
        
        # Pattern 4: Small consistent values (possible draining or farming)
        if sent_values:
            sent_std = np.std(sent_values) if len(sent_values) > 1 else 0
            sent_mean = np.mean(sent_values) if sent_values else 0
            if sent_mean > 0 and sent_std < sent_mean * 0.2 and len(sent_values) > 10:
                patterns.append("consistent_small_values")
                risk_level += 0.2
        
        return {
            "patterns": patterns,
            "risk_level": min(risk_level, 1.0),
            "round_value_ratio": round_count / len(sent_values + received_values) if (sent_values + received_values) else 0,
            "value_balance_ratio": min(sum(sent_values), sum(received_values)) / max(sum(sent_values), sum(received_values), 1)
        }
    
    @staticmethod
    def _analyze_network_patterns(sent: List[Dict], received: List[Dict]) -> Dict[str, Any]:
        """Analyze network interaction patterns"""
        sent_addresses = []
        for tx in sent:
            if tx is not None:
                addr = tx.get("to")
                if addr and isinstance(addr, str):
                    sent_addresses.append(addr.lower())
        
        received_addresses = []
        for tx in received:
            if tx is not None:
                addr = tx.get("from")
                if addr and isinstance(addr, str):
                    received_addresses.append(addr.lower())
        
        patterns = []
        risk_level = 0
        
        # Pattern 1: High unique address diversity (possible mixer/tumbler)
        unique_sent = len(set(sent_addresses))
        unique_received = len(set(received_addresses))
        total_txs = len(sent) + len(received)
        
        if total_txs > 0:
            diversity_ratio = (unique_sent + unique_received) / total_txs
            if diversity_ratio > 0.8 and total_txs > 50:
                patterns.append("high_address_diversity")
                risk_level += 0.4
        
        # Pattern 2: One-time interactions (typical of mixers)
        if sent_addresses:
            address_counts = Counter(sent_addresses)
            one_time = sum(1 for count in address_counts.values() if count == 1)
            one_time_ratio = one_time / len(set(sent_addresses)) if sent_addresses else 0
            if one_time_ratio > 0.7 and len(sent_addresses) > 20:
                patterns.append("predominantly_one_time_interactions")
                risk_level += 0.3
        
        # Pattern 3: Circular flow detection (send to A, A sends back)
        sent_set = set(sent_addresses)
        received_set = set(received_addresses)
        circular = sent_set.intersection(received_set)
        if len(circular) > 5 and total_txs > 10:
            circular_ratio = len(circular) / min(len(sent_set), len(received_set), 1)
            if circular_ratio > 0.3:
                patterns.append("circular_flow_detected")
                risk_level += 0.5
        
        # Pattern 4: Interaction with known service contracts (exchanges, mixers)
        # These would be common addresses - simplified check
        common_patterns = ["0x00000", "0x11111", "0xdead", "0xaaaa", "0xbbbb"]
        suspicious_interactions = sum(1 for addr in sent_addresses 
                                     if any(pattern in addr for pattern in common_patterns))
        if suspicious_interactions > 5:
            patterns.append("suspicious_address_interactions")
            risk_level += 0.2
        
        return {
            "patterns": patterns,
            "risk_level": min(risk_level, 1.0),
            "unique_counterparties": unique_sent + unique_received,
            "address_diversity_ratio": diversity_ratio if total_txs > 0 else 0,
            "circular_addresses": len(circular)
        }
    
    @staticmethod
    def _analyze_token_patterns(sent: List[Dict], received: List[Dict]) -> Dict[str, Any]:
        """Analyze ERC20 token patterns"""
        sent_erc20 = [tx for tx in sent if tx is not None and tx.get("category") in ["erc20", "erc721", "erc1155"]]
        received_erc20 = [tx for tx in received if tx is not None and tx.get("category") in ["erc20", "erc721", "erc1155"]]
        
        patterns = []
        risk_level = 0
        
        if not (sent_erc20 or received_erc20):
            return {"patterns": [], "risk_level": 0, "unique_tokens": 0}
        
        # Get token addresses
        sent_tokens = []
        for tx in sent_erc20:
            if tx is None:
                continue
            raw_contract = tx.get("rawContract")
            if raw_contract and isinstance(raw_contract, dict):
                addr = raw_contract.get("address", "")
                if addr:
                    sent_tokens.append(addr.lower())
        
        received_tokens = []
        for tx in received_erc20:
            if tx is None:
                continue
            raw_contract = tx.get("rawContract")
            if raw_contract and isinstance(raw_contract, dict):
                addr = raw_contract.get("address", "")
                if addr:
                    received_tokens.append(addr.lower())
        
        unique_tokens = len(set(sent_tokens + received_tokens))
        
        # Pattern 1: Excessive token diversity (possible airdrop farmer)
        if unique_tokens > 30:
            patterns.append("excessive_token_diversity")
            risk_level += 0.3
        
        # Pattern 2: Token wash trading
        token_flow = defaultdict(lambda: {"sent": 0, "received": 0})
        for token in sent_tokens:
            token_flow[token]["sent"] += 1
        for token in received_tokens:
            token_flow[token]["received"] += 1
        
        wash_candidates = sum(1 for token, counts in token_flow.items()
                             if counts["sent"] > 3 and counts["received"] > 3
                             and abs(counts["sent"] - counts["received"]) <= 2)
        if wash_candidates >= 3:
            patterns.append("token_wash_trading_pattern")
            risk_level += 0.6
        
        # Pattern 3: NFT flipping pattern (ERC721)
        nft_txs = [tx for tx in sent_erc20 + received_erc20 if tx is not None and tx.get("category") == "erc721"]
        if len(nft_txs) > 20:
            patterns.append("high_nft_activity")
            risk_level += 0.1  # NFT trading is legitimate but worth noting
        
        return {
            "patterns": patterns,
            "risk_level": min(risk_level, 1.0),
            "unique_tokens": unique_tokens,
            "wash_trading_candidates": wash_candidates,
            "nft_transaction_count": len(nft_txs)
        }
    
    @staticmethod
    def _detect_behavioral_flags(sent: List[Dict], received: List[Dict], 
                                 account_data: Dict[str, Any]) -> Dict[str, Any]:
        """Detect specific behavioral fraud flags"""
        flags = []
        risk_level = 0
        
        balance = account_data.get("balance", 0)
        total_sent = len(sent)
        total_received = len(received)
        
        # Flag 1: Dust account (high activity, near-zero balance)
        if (total_sent + total_received) > 100 and balance < 0.01:
            flags.append("dust_account_high_activity")
            risk_level += 0.5
        
        # Flag 2: Immediate forwarding (receive then immediately send)
        if len(received) > 10 and len(sent) > 10:
            received_times = []
            sent_times = []
            
            for tx in received:
                if tx is None:
                    continue
                metadata = tx.get("metadata")
                if metadata and isinstance(metadata, dict) and metadata.get("blockTimestamp"):
                    try:
                        dt = datetime.fromisoformat(
                            metadata["blockTimestamp"].replace("Z", "+00:00")
                        )
                        received_times.append(dt.timestamp())
                    except:
                        pass
            
            for tx in sent:
                if tx is None:
                    continue
                metadata = tx.get("metadata")
                if metadata and isinstance(metadata, dict) and metadata.get("blockTimestamp"):
                    try:
                        dt = datetime.fromisoformat(
                            metadata["blockTimestamp"].replace("Z", "+00:00")
                        )
                        sent_times.append(dt.timestamp())
                    except:
                        pass
            
            # Check for pattern of receiving then sending within short timeframe
            immediate_forwards = 0
            for rt in received_times:
                for st in sent_times:
                    if 0 < (st - rt) < 300:  # Within 5 minutes
                        immediate_forwards += 1
                        break
            
            if immediate_forwards > 10:
                flags.append("immediate_forwarding_pattern")
                risk_level += 0.6
        
        # Flag 3: Asymmetric transaction pattern (mostly sending or mostly receiving)
        if total_sent + total_received > 20:
            ratio = total_sent / (total_sent + total_received)
            if ratio > 0.9 or ratio < 0.1:
                flags.append("asymmetric_transaction_pattern")
                risk_level += 0.2
        
        # Flag 4: Zero-value spam
        zero_value_count = 0
        for tx in sent + received:
            if tx is None:
                continue
            try:
                val = tx.get("value", 0)
                if val is not None and float(val) == 0:
                    zero_value_count += 1
            except (ValueError, TypeError):
                pass
        if (total_sent + total_received) > 0:
            zero_ratio = zero_value_count / (total_sent + total_received)
            if zero_ratio > 0.5 and (total_sent + total_received) > 50:
                flags.append("excessive_zero_value_transactions")
                risk_level += 0.3
        
        return {
            "flags": flags,
            "risk_level": min(risk_level, 1.0),
            "balance": balance,
            "tx_asymmetry": abs(total_sent - total_received) / max(total_sent + total_received, 1)
        }
    
    @staticmethod
    def _calculate_risk_score(patterns: Dict[str, Any]) -> float:
        """Calculate overall risk score from all patterns"""
        risk_scores = [
            patterns.get("temporal_patterns", {}).get("risk_level", 0),
            patterns.get("value_patterns", {}).get("risk_level", 0),
            patterns.get("network_patterns", {}).get("risk_level", 0),
            patterns.get("token_patterns", {}).get("risk_level", 0),
            patterns.get("behavioral_flags", {}).get("risk_level", 0)
        ]
        
        # Weighted average (behavioral flags weighted more heavily)
        weights = [0.15, 0.25, 0.25, 0.15, 0.20]
        weighted_score = sum(score * weight for score, weight in zip(risk_scores, weights))
        
        return min(weighted_score, 1.0)


class RAGService:
    """Enhanced RAG service using deep Alchemy data analysis"""
    
    def __init__(self, api_key: str):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=api_key,
            temperature=0.1,
            convert_system_message_to_human=True
        )
        self.pattern_analyzer = AlchemyPatternAnalyzer()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build enhanced LangGraph workflow"""
        workflow = StateGraph(dict)
        
        # Add nodes
        workflow.add_node("deep_pattern_analysis", self._deep_pattern_analysis_node)
        workflow.add_node("analyze_knn", self._analyze_knn_node)
        workflow.add_node("detect_edge_cases", self._detect_edge_cases_node)
        workflow.add_node("cross_validate", self._cross_validate_node)
        workflow.add_node("final_decision", self._final_decision_node)
        
        # Add edges
        workflow.add_edge("deep_pattern_analysis", "analyze_knn")
        workflow.add_edge("analyze_knn", "detect_edge_cases")
        workflow.add_edge("detect_edge_cases", "cross_validate")
        workflow.add_edge("cross_validate", "final_decision")
        
        # Set entry and finish points
        workflow.set_entry_point("deep_pattern_analysis")
        workflow.set_finish_point("final_decision")
        
        return workflow.compile()
    
    def _deep_pattern_analysis_node(self, state: Dict) -> Dict:
        """NEW: Deep analysis of Alchemy transaction data"""
        logger.info("RAG: Performing deep pattern analysis on Alchemy data")
        
        account_data = state.get("account_data", {})
        if not account_data:
            # If not provided, create minimal structure
            account_data = {
                "sent_transfers": [],
                "received_transfers": [],
                "balance": state["features"].get("total ether balance", 0)
            }
        
        patterns = self.pattern_analyzer.analyze_transaction_patterns(account_data)
        state["deep_patterns"] = patterns
        
        logger.info(f"Pattern analysis complete. Risk score: {patterns['risk_score']:.2f}")
        return state
    
    def _analyze_knn_node(self, state: Dict) -> Dict:
        """Enhanced K-NN analysis with deep pattern context"""
        logger.info("RAG: Analyzing K-NN results with deep patterns")
        
        knn_result = state["knn_result"]
        features = state["features"]
        deep_patterns = state.get("deep_patterns", {})
        
        # Collect all detected patterns
        all_patterns = []
        for pattern_type, pattern_data in deep_patterns.items():
            if pattern_type == "risk_score":
                continue
            if isinstance(pattern_data, dict) and "patterns" in pattern_data:
                all_patterns.extend(pattern_data["patterns"])
            elif isinstance(pattern_data, dict) and "flags" in pattern_data:
                all_patterns.extend(pattern_data["flags"])
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an elite fraud detection analyst specializing in Ethereum blockchain forensics.
Your analysis must be thorough, evidence-based, and conservative. Focus on identifying concrete fraud indicators."""),
            ("human", """Analyze this Ethereum account for fraud:

**K-NN Machine Learning Analysis:**
- Fraud Probability: {fraud_prob:.2%}
- Model Confidence: {confidence:.2%}
- Fraudulent Neighbors: {fraud_count}/{total_count}
- Average Distance to Neighbors: {avg_distance:.4f}

**Account Statistics:**
- Total Transactions: {total_tx}
- Sent: {sent_tx} | Received: {received_tx}
- Total Ether Sent: {ether_sent:.6f} ETH
- Total Ether Received: {ether_received:.6f} ETH
- Current Balance: {balance:.6f} ETH
- Unique Addresses Contacted: {unique_sent}
- Unique Addresses Received From: {unique_received}
- ERC20 Token Transactions: {erc20_tx}

**Deep Pattern Analysis Results:**
- Overall Behavioral Risk Score: {behavioral_risk:.2%}
- Detected Patterns: {detected_patterns}

**Temporal Patterns:**
{temporal_info}

**Value Transfer Patterns:**
{value_info}

**Network Interaction Patterns:**
{network_info}

**Token Activity Patterns:**
{token_info}

**Behavioral Flags:**
{behavioral_info}

Provide a comprehensive fraud analysis focusing on:
1. Correlation between K-NN prediction and detected patterns
2. Specific evidence of fraudulent behavior
3. Legitimate explanations for unusual patterns
4. Overall fraud likelihood assessment""")
        ])
        
        chain = prompt | self.llm
        
        temporal = deep_patterns.get("temporal_patterns", {})
        value = deep_patterns.get("value_patterns", {})
        network = deep_patterns.get("network_patterns", {})
        token = deep_patterns.get("token_patterns", {})
        behavioral = deep_patterns.get("behavioral_flags", {})
        
        response = chain.invoke({
            "fraud_prob": knn_result.get("fraud_probability", 0),
            "confidence": knn_result.get("confidence", 0),
            "fraud_count": knn_result.get("fraud_count", 0),
            "total_count": knn_result.get("total_count", 0),
            "avg_distance": knn_result.get("avg_distance", 0),
            "total_tx": features.get("total transactions (including tnx to create contract)", 0),
            "sent_tx": features.get("Sent tnx", 0),
            "received_tx": features.get("Received Tnx", 0),
            "ether_sent": features.get("total Ether sent", 0),
            "ether_received": features.get("total ether received", 0),
            "balance": features.get("total ether balance", 0),
            "unique_sent": features.get("Unique Sent To Addresses", 0),
            "unique_received": features.get("Unique Received From Addresses", 0),
            "erc20_tx": features.get(" Total ERC20 tnxs", 0),
            "behavioral_risk": deep_patterns.get("risk_score", 0),
            "detected_patterns": ", ".join(all_patterns) if all_patterns else "None detected",
            "temporal_info": json.dumps(temporal, indent=2),
            "value_info": json.dumps(value, indent=2),
            "network_info": json.dumps(network, indent=2),
            "token_info": json.dumps(token, indent=2),
            "behavioral_info": json.dumps(behavioral, indent=2)
        })
        
        state["analysis"] = response.content
        return state
    
    def _detect_edge_cases_node(self, state: Dict) -> Dict:
        """Enhanced edge case detection"""
        logger.info("RAG: Detecting edge cases")
        
        features = state["features"]
        knn_result = state["knn_result"]
        deep_patterns = state.get("deep_patterns", {})
        
        edge_cases = []
        
        # Traditional edge cases
        sent_tx = features.get("Sent tnx", 0)
        received_tx = features.get("Received Tnx", 0)
        balance = features.get("total ether balance", 0)
        ether_sent = features.get("total Ether sent", 0)
        ether_received = features.get("total ether received", 0)
        
        if (sent_tx + received_tx) > 100 and balance < 0.1:
            edge_cases.append("High transaction volume with minimal balance - possible mixer/tumbler")
        
        if sent_tx > 0 and received_tx > 0:
            ratio = sent_tx / received_tx if received_tx > 0 else float('inf')
            if ratio > 10 or ratio < 0.1:
                edge_cases.append(f"Highly imbalanced transaction ratio ({ratio:.2f})")
        
        if ether_sent > 1000 or ether_received > 1000:
            edge_cases.append("Large value movements detected - high-value account")
        
        time_range = features.get("Time Diff between first and last (Mins)", 0)
        if time_range < 1440 and (sent_tx + received_tx) > 50:
            edge_cases.append("High activity in short time period - possible bot")
        
        if knn_result.get("confidence", 0) < 0.5:
            edge_cases.append("K-NN low confidence - unusual account pattern")
        
        erc20_tx = features.get(" Total ERC20 tnxs", 0)
        total_tx = features.get("total transactions (including tnx to create contract)", 0)
        if total_tx > 0 and (erc20_tx / total_tx) > 0.8:
            edge_cases.append("Heavy ERC20 usage - DeFi power user")
        
        # Add pattern-based edge cases
        for pattern_type, pattern_data in deep_patterns.items():
            if pattern_type == "risk_score":
                continue
            if isinstance(pattern_data, dict):
                risk = pattern_data.get("risk_level", 0)
                if risk > 0.5:
                    edge_cases.append(f"High-risk {pattern_type} detected (score: {risk:.2f})")
        
        state["edge_cases"] = edge_cases
        return state
    
    def _cross_validate_node(self, state: Dict) -> Dict:
        """Multi-layer cross-validation"""
        logger.info("RAG: Cross-validating all signals")
        
        knn_result = state["knn_result"]
        features = state["features"]
        deep_patterns = state.get("deep_patterns", {})
        edge_cases = state.get("edge_cases", [])
        
        validation_checks = {}
        
        fraud_prob = knn_result.get("fraud_probability", 0)
        knn_confidence = knn_result.get("confidence", 0)
        behavioral_risk = deep_patterns.get("risk_score", 0)
        
        # Check 1: K-NN and behavioral pattern alignment
        if (fraud_prob > 0.7 and behavioral_risk > 0.6) or (fraud_prob < 0.3 and behavioral_risk < 0.4):
            validation_checks["knn_pattern_alignment"] = True
        else:
            validation_checks["knn_pattern_alignment"] = False
        
        # Check 2: Confidence threshold met
        validation_checks["confidence_threshold_met"] = knn_confidence >= 0.4
        
        # Check 3: Pattern consistency (multiple independent signals)
        high_risk_patterns = sum(1 for pattern_type in ["temporal_patterns", "value_patterns", 
                                                          "network_patterns", "behavioral_flags"]
                                if deep_patterns.get(pattern_type, {}).get("risk_level", 0) > 0.5)
        validation_checks["multiple_risk_signals"] = high_risk_patterns >= 2
        
        # Check 4: Mixer/tumbler profile check
        is_mixer = (
            "mixer_value_pattern" in str(deep_patterns) or
            "high_address_diversity" in str(deep_patterns) or
            "dust_account_high_activity" in str(deep_patterns)
        )
        validation_checks["mixer_profile_detected"] = is_mixer
        
        # Check 5: Wash trading check
        is_wash_trading = (
            "token_wash_trading_pattern" in str(deep_patterns) or
            "matching_send_receive_values" in str(deep_patterns)
        )
        validation_checks["wash_trading_detected"] = is_wash_trading
        
        # Check 6: Bot-like behavior
        is_bot = (
            "regular_interval_activity" in str(deep_patterns) or
            "burst_activity_detected" in str(deep_patterns)
        )
        validation_checks["bot_behavior_detected"] = is_bot
        
        # Overall validation score
        validation_score = (
            0.3 * int(validation_checks["knn_pattern_alignment"]) +
            0.2 * int(validation_checks["confidence_threshold_met"]) +
            0.3 * int(validation_checks["multiple_risk_signals"]) +
            0.2 * (1 - abs(fraud_prob - behavioral_risk))  # Alignment score
        )
        
        validation_checks["overall_validation_score"] = validation_score
        validation_checks["decision_quality"] = "high" if validation_score > 0.7 else "medium" if validation_score > 0.4 else "low"
        
        state["validation_checks"] = validation_checks
        return state
    
    def _final_decision_node(self, state: Dict) -> Dict:
        """Balanced final decision with accuracy target"""
        logger.info("RAG: Making final decision")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert fraud detection system optimized for BALANCED ACCURACY and DECISIVENESS.

    **Decision Framework (Relaxed for better coverage):**

    **Mark as "Fraud" if ANY of these conditions:**
    1. K-NN fraud probability > 0.65 AND behavioral risk > 0.5
    2. K-NN fraud probability > 0.6 AND at least 2 strong fraud patterns detected
    3. K-NN fraud probability > 0.5 AND behavioral risk > 0.6 AND validation quality is "high"
    4. Behavioral risk > 0.7 AND at least 3 strong fraud indicators (mixer, wash trading, etc.)

    **Mark as "Not_Fraud" if ANY of these conditions:**
    1. K-NN fraud probability < 0.35 AND behavioral risk < 0.35
    2. K-NN fraud probability < 0.4 AND no significant fraud patterns detected
    3. K-NN fraud probability < 0.3 AND behavioral risk < 0.5
    4. Clear legitimate DeFi/trading patterns with K-NN < 0.5

    **Mark as "Undecided" ONLY when:**
    - K-NN probability between 0.4-0.6 AND conflicting signals
    - Very low K-NN confidence (< 0.3) regardless of score
    - Validation quality is "low" AND no clear patterns
    - Exactly balanced evidence for both fraud and legitimate activity

    **Confidence Levels:**
    - High (0.75-1.0): Multiple signals strongly aligned
    - Medium (0.5-0.75): Good evidence, reasonable alignment
    - Low (0.3-0.5): Weak or conflicting signals
    - Very Low (0.0-0.3): Insufficient data or highly ambiguous

    **Important:** Be decisive when evidence is reasonably clear. "Undecided" should be the exception, not the default.

    Respond ONLY in valid JSON format:
    {{
    "final_decision": "Fraud|Not_Fraud|Undecided",
    "reasoning": "detailed explanation with specific evidence",
    "confidence": 0.0-1.0,
    "edge_cases_detected": ["list of edge cases"],
    "risk_factors": ["specific fraud indicators with evidence"],
    "validation_checks": {{}},
    "behavioral_score": 0.0-1.0
    }}"""),
            ("human", """Make final fraud determination with balanced decisiveness:

    **Address:** {address}

    **K-NN Analysis:**
    - Fraud Probability: {fraud_prob:.2%}
    - Model Confidence: {knn_confidence:.2%}
    - Fraudulent Neighbors: {fraud_count}/{total_count}

    **Behavioral Analysis:**
    - Overall Risk Score: {behavioral_risk:.2%}
    - Risk Assessment: {risk_assessment}

    **LLM Analysis:**
    {analysis}

    **Edge Cases:**
    {edge_cases}

    **Validation Checks:**
    {validation_checks}

    **Decision Quality:** {decision_quality}

    **Critical Instruction:** Make a decisive classification when evidence is reasonably clear (even if not 100% certain). Use "Undecided" sparingly - only when evidence is truly conflicting or insufficient.

    Provide your final decision in JSON format ONLY.""")
        ])
        
        chain = prompt | self.llm
        
        knn_result = state["knn_result"]
        deep_patterns = state.get("deep_patterns", {})
        validation_checks = state.get("validation_checks", {})
        behavioral_risk = deep_patterns.get("risk_score", 0)
        
        risk_assessment = "HIGH RISK" if behavioral_risk > 0.6 else "MEDIUM RISK" if behavioral_risk > 0.35 else "LOW RISK"
        
        response = chain.invoke({
            "address": state["address"],
            "fraud_prob": knn_result.get("fraud_probability", 0),
            "knn_confidence": knn_result.get("confidence", 0),
            "fraud_count": knn_result.get("fraud_count", 0),
            "total_count": knn_result.get("total_count", 0),
            "behavioral_risk": behavioral_risk,
            "risk_assessment": risk_assessment,
            "analysis": state["analysis"],
            "edge_cases": "\n".join(f"- {ec}" for ec in state["edge_cases"]) if state["edge_cases"] else "None",
            "validation_checks": json.dumps(validation_checks, indent=2),
            "decision_quality": validation_checks.get("decision_quality", "unknown")
        })
        
        # Parse and validate response
        try:
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            result = json.loads(content.strip())
            
            # Apply BALANCED post-processing (less aggressive overrides)
            fraud_prob = knn_result.get("fraud_probability", 0)
            knn_confidence = knn_result.get("confidence", 0)
            validation_score = validation_checks.get("overall_validation_score", 0)
            
            # Only override to Undecided in extreme cases
            if knn_confidence < 0.25:  # Very low confidence only (was 0.4)
                if result["final_decision"] != "Undecided":
                    result["reasoning"] += " [Overridden to Undecided due to very low K-NN confidence]"
                    result["final_decision"] = "Undecided"
                    result["confidence"] = min(result.get("confidence", 0.4), 0.4)
            
            # Relaxed enforcement thresholds - only override obvious mistakes
            if result["final_decision"] == "Fraud":
                # Only override if BOTH are clearly too low
                if fraud_prob < 0.5 and behavioral_risk < 0.4 and knn_confidence > 0.3:
                    result["final_decision"] = "Undecided"
                    result["reasoning"] += " [Adjusted to Undecided - weak fraud signals]"
                    result["confidence"] = min(result.get("confidence", 0.5), 0.5)
            
            if result["final_decision"] == "Not_Fraud":
                # Only override if BOTH are clearly too high
                if fraud_prob > 0.6 and behavioral_risk > 0.6:
                    result["final_decision"] = "Undecided"
                    result["reasoning"] += " [Adjusted to Undecided - strong fraud signals present]"
                    result["confidence"] = min(result.get("confidence", 0.5), 0.5)
            
            # Ensure all required fields
            result["validation_checks"] = validation_checks
            result["behavioral_score"] = behavioral_risk
            
            state["final_output"] = result
            
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}. Response: {response.content[:200]}")
            # More decisive fallback
            fraud_prob = knn_result.get("fraud_probability", 0)
            knn_confidence = knn_result.get("confidence", 0)
            
            # Use majority voting approach
            fraud_signals = 0
            legitimate_signals = 0
            
            # Signal 1: K-NN
            if fraud_prob > 0.6:
                fraud_signals += 2
            elif fraud_prob < 0.4:
                legitimate_signals += 2
            
            # Signal 2: Behavioral risk
            if behavioral_risk > 0.6:
                fraud_signals += 2
            elif behavioral_risk < 0.35:
                legitimate_signals += 2
            
            # Signal 3: Validation
            if validation_checks.get("mixer_profile_detected") or validation_checks.get("wash_trading_detected"):
                fraud_signals += 1
            
            if validation_checks.get("knn_pattern_alignment"):
                if fraud_prob > 0.5:
                    fraud_signals += 1
                else:
                    legitimate_signals += 1
            
            # Decide based on signals
            if fraud_signals >= 3:
                decision = "Fraud"
                confidence = min(0.7, fraud_signals / 5)
            elif legitimate_signals >= 3:
                decision = "Not_Fraud"
                confidence = min(0.7, legitimate_signals / 5)
            else:
                decision = "Undecided"
                confidence = 0.4
            
            state["final_output"] = {
                "final_decision": decision,
                "reasoning": state["analysis"] + f" [Fallback decision based on {fraud_signals} fraud signals vs {legitimate_signals} legitimate signals]",
                "confidence": confidence,
                "edge_cases_detected": state["edge_cases"],
                "risk_factors": [],
                "validation_checks": validation_checks,
                "behavioral_score": behavioral_risk
            }
        
        return state
    
    async def analyze(
        self,
        address: str,
        knn_result: Dict[str, Any],
        features: Dict[str, float],
        account_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Run enhanced RAG analysis with deep Alchemy data analysis
        
        Args:
            address: Ethereum address
            knn_result: Results from K-NN analysis
            features: Extracted features
            account_data: Raw Alchemy account data (optional but recommended)
        
        Returns:
            Final analysis with decision, validation, and behavioral scoring
        """
        logger.info(f"Starting enhanced RAG analysis for {address}")
        
        initial_state = {
            "address": address,
            "knn_result": knn_result,
            "features": features,
            "account_data": account_data or {}
        }
        
        # Run the enhanced graph
        final_state = self.graph.invoke(initial_state)
        
        return final_state["final_output"]