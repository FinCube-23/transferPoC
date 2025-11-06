from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from langgraph.graph import Graph, StateGraph
from pydantic import BaseModel, Field
import logging
import json

logger = logging.getLogger(__name__)


class RAGOutput(BaseModel):
    """Structured output from RAG analysis"""
    final_decision: str = Field(description="Final fraud decision: True, False, or Undecided")
    reasoning: str = Field(description="Detailed reasoning for the decision")
    confidence: float = Field(description="Confidence score 0-1")
    edge_cases_detected: List[str] = Field(description="List of edge cases or anomalies detected")
    risk_factors: List[str] = Field(description="Specific risk factors identified")


class RAGState(BaseModel):
    """State for LangGraph workflow"""
    address: str
    knn_result: Dict[str, Any]
    features: Dict[str, float]
    analysis: str = ""
    edge_cases: List[str] = []
    final_output: Dict[str, Any] = {}


class RAGService:
    """RAG service using LangChain and LangGraph with Gemini"""
    
    def __init__(self, api_key: str):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-pro",
            google_api_key=api_key,
            temperature=0.1,
            convert_system_message_to_human=True
        )
        self.output_parser = PydanticOutputParser(pydantic_object=RAGOutput)
        self.graph = self._build_graph()
    
    def _build_graph(self) -> Graph:
        """Build LangGraph workflow for fraud analysis"""
        workflow = StateGraph(dict)
        
        # Add nodes
        workflow.add_node("analyze_knn", self._analyze_knn_node)
        workflow.add_node("detect_edge_cases", self._detect_edge_cases_node)
        workflow.add_node("final_decision", self._final_decision_node)
        
        # Add edges
        workflow.add_edge("analyze_knn", "detect_edge_cases")
        workflow.add_edge("detect_edge_cases", "final_decision")
        
        # Set entry point
        workflow.set_entry_point("analyze_knn")
        workflow.set_finish_point("final_decision")
        
        return workflow.compile()
    
    def _analyze_knn_node(self, state: Dict) -> Dict:
        """Analyze K-NN results"""
        logger.info("RAG: Analyzing K-NN results")
        
        knn_result = state["knn_result"]
        features = state["features"]
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert fraud detection analyst specializing in Ethereum transactions.
Analyze the K-NN results and account features to provide insights."""),
            ("human", """Analyze this Ethereum account for fraud:

K-NN Analysis:
- Fraud Probability: {fraud_prob:.2%}
- Confidence: {confidence:.2%}
- Fraud Neighbors: {fraud_count}/{total_count}
- Average Distance: {avg_distance:.4f}

Key Account Features:
- Total Transactions: {total_tx}
- Sent: {sent_tx}, Received: {received_tx}
- Total Ether Sent: {ether_sent:.4f}
- Total Ether Received: {ether_received:.4f}
- Current Balance: {balance:.4f}
- Unique Addresses (Sent): {unique_sent}
- Unique Addresses (Received): {unique_received}
- ERC20 Transactions: {erc20_tx}

Provide a brief analysis of what these patterns suggest.""")
        ])
        
        chain = prompt | self.llm
        
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
            "erc20_tx": features.get(" Total ERC20 tnxs", 0)
        })
        
        state["analysis"] = response.content
        return state
    
    def _detect_edge_cases_node(self, state: Dict) -> Dict:
        """Detect edge cases and anomalies"""
        logger.info("RAG: Detecting edge cases")
        
        features = state["features"]
        knn_result = state["knn_result"]
        
        edge_cases = []
        
        # Check for suspicious patterns in below fields.
        sent_tx = features.get("Sent tnx", 0)
        received_tx = features.get("Received Tnx", 0)
        balance = features.get("total ether balance", 0)
        ether_sent = features.get("total Ether sent", 0)
        ether_received = features.get("total ether received", 0)
        
        # Edge case 1: High transaction volume with low balance
        if (sent_tx + received_tx) > 100 and balance < 0.1:
            edge_cases.append("High transaction volume with minimal balance - possible mixer/tumbler")
        
        # Edge case 2: Imbalanced sent/received ratio
        if sent_tx > 0 and received_tx > 0:
            ratio = sent_tx / received_tx if received_tx > 0 else float('inf')
            if ratio > 10 or ratio < 0.1:
                edge_cases.append(f"Highly imbalanced transaction ratio ({ratio:.2f}) - unusual pattern")
        
        # Edge case 3: Large value movements
        if ether_sent > 1000 or ether_received > 1000:
            edge_cases.append("Large value movements detected - high-value account")
        
        # Edge case 4: New account with high activity
        time_range = features.get("Time Diff between first and last (Mins)", 0)
        if time_range < 1440 and (sent_tx + received_tx) > 50:  # Less than 1 day
            edge_cases.append("High activity in short time period - possible bot or automated system")
        
        # Edge case 5: K-NN uncertainty
        if knn_result.get("confidence", 0) < 0.5:
            edge_cases.append("K-NN model shows low confidence - account pattern not well represented in training data")
        
        # Edge case 6: ERC20 heavy usage
        erc20_tx = features.get(" Total ERC20 tnxs", 0)
        total_tx = features.get("total transactions (including tnx to create contract)", 0)
        if total_tx > 0 and (erc20_tx / total_tx) > 0.8:
            edge_cases.append("Heavy ERC20 token usage - possible token trader or DeFi user")
        
        state["edge_cases"] = edge_cases
        return state
    
    def _final_decision_node(self, state: Dict) -> Dict:
        """Make final decision with LLM"""
        logger.info("RAG: Making final decision")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert fraud detection system. Based on K-NN analysis and edge case detection,
make a final fraud determination. Be conservative - only mark as fraud if there's strong evidence.

Respond in JSON format:
{
  "final_decision": "True|False|Undecided",
  "reasoning": "detailed explanation",
  "confidence": 0.0-1.0,
  "edge_cases_detected": ["list of edge cases"],
  "risk_factors": ["specific risk factors"]
}"""),
            ("human", """Make final fraud determination:

Address: {address}

K-NN Analysis:
{knn_analysis}

Initial Analysis:
{analysis}

Edge Cases Detected:
{edge_cases}

Provide your final decision in JSON format.""")
        ])
        
        chain = prompt | self.llm
        
        knn_result = state["knn_result"]
        knn_summary = f"""
- Fraud Probability: {knn_result.get('fraud_probability', 0):.2%}
- Confidence: {knn_result.get('confidence', 0):.2%}
- Fraud Neighbors: {knn_result.get('fraud_count', 0)}/{knn_result.get('total_count', 0)}
- Average Distance: {knn_result.get('avg_distance', 0):.4f}
"""
        
        response = chain.invoke({
            "address": state["address"],
            "knn_analysis": knn_summary,
            "analysis": state["analysis"],
            "edge_cases": "\n".join(f"- {ec}" for ec in state["edge_cases"]) if state["edge_cases"] else "None detected"
        })
        
        # Parse JSON response
        try:
            # Extract JSON from response
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            result = json.loads(content.strip())
            state["final_output"] = result
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            # Fallback to K-NN decision
            fraud_prob = knn_result.get("fraud_probability", 0)
            state["final_output"] = {
                "final_decision": "True" if fraud_prob > 0.7 else "False" if fraud_prob < 0.3 else "Undecided",
                "reasoning": state["analysis"],
                "confidence": knn_result.get("confidence", 0),
                "edge_cases_detected": state["edge_cases"],
                "risk_factors": []
            }
        
        return state
    
    async def analyze(
        self,
        address: str,
        knn_result: Dict[str, Any],
        features: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Run RAG analysis workflow
        
        Args:
            address: Ethereum address
            knn_result: Results from K-NN analysis
            features: Extracted features
        
        Returns:
            Final analysis with decision
        """
        logger.info(f"Starting RAG analysis for {address}")
        
        initial_state = {
            "address": address,
            "knn_result": knn_result,
            "features": features
        }
        
        # Run the graph
        final_state = self.graph.invoke(initial_state)
        
        return final_state["final_output"]
