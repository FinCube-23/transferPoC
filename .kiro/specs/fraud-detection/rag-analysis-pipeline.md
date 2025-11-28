---
title: RAG Analysis Pipeline
status: implemented
created: 2024-11-19
---

# RAG Analysis Pipeline

## Overview
LangGraph-based multi-agent system for analyzing blockchain addresses and detecting fraudulent patterns using retrieval-augmented generation.

## Pipeline Architecture

### Graph Structure
```
START
  ↓
analyze_knn → deep_pattern_analysis → cross_validate → detect_edge_cases → final_decision
  ↓              ↓                      ↓                 ↓                   ↓
END ←──────────────────────────────────────────────────────────────────────┘
```

## Node Descriptions

### 1. Analyze KNN Node
**Purpose**: Initial analysis of KNN neighbors

**Inputs**:
- KNN search results (10 neighbors)
- Neighbor fraud labels
- Distance scores

**Outputs**:
- Fraud percentage among neighbors
- Initial risk assessment
- Neighbor distribution analysis

**Logic**:
```python
fraud_count = sum(1 for n in neighbors if n['FLAG'] == 1)
fraud_percentage = (fraud_count / total_neighbors) * 100
```

### 2. Deep Pattern Analysis Node
**Purpose**: Detect behavioral patterns from transaction data

**Pattern Categories**:

#### Temporal Patterns
- Transaction frequency analysis
- Time gaps between transactions
- Activity bursts detection

#### Network Patterns
- Unique address interactions
- Contract creation patterns
- Address clustering

#### Value Patterns
- Transaction value distributions
- Unusual value transfers
- Balance inconsistencies

#### Token Patterns
- ERC20 token diversity
- Token concentration
- Token type preferences

**Behavioral Flags**:
- High-frequency trading
- Mixer-like behavior
- Sybil attack indicators
- Wash trading patterns

### 3. Cross Validation Node
**Purpose**: Validate findings across multiple data sources

**Validation Checks**:
- KNN results vs. feature analysis
- Historical patterns vs. current behavior
- Token activity vs. ETH activity
- Sent vs. received transaction patterns

**Confidence Scoring**:
- Consistent patterns: +0.2 confidence
- Contradictory patterns: -0.1 confidence
- Missing data: neutral impact

### 4. Edge Case Detection Node
**Purpose**: Identify unusual or edge case scenarios

**Edge Cases**:
- New accounts (< 10 transactions)
- Dormant accounts (no recent activity)
- High-value single transactions
- Contract-only interactions
- Token-only accounts

**Adjustments**:
- Reduce confidence for insufficient data
- Flag unusual patterns for manual review
- Adjust risk score based on account age

### 5. Final Decision Node
**Purpose**: Synthesize all analyses into final verdict

**Decision Factors**:
1. KNN fraud percentage (weight: 0.3)
2. Pattern analysis score (weight: 0.3)
3. Behavioral flags (weight: 0.2)
4. Cross-validation confidence (weight: 0.2)

**Risk Levels**:
- `critical`: score ≥ 0.8
- `high`: 0.6 ≤ score < 0.8
- `medium`: 0.4 ≤ score < 0.6
- `low`: score < 0.4

## State Management

### State Schema
```python
{
    "address": str,
    "knn_result": Dict,
    "features": Dict[str, float],
    "account_data": Dict,
    "patterns": Dict,
    "behavioral_flags": List[str],
    "confidence": float,
    "risk_score": float,
    "reasoning": str,
    "key_findings": List[str]
}
```

## Pattern Detection Algorithms

### Temporal Analysis
```python
def analyze_temporal_patterns(sent, received):
    avg_time_sent = calculate_avg_time_diff(sent)
    avg_time_received = calculate_avg_time_diff(received)
    
    if avg_time_sent < 60:  # < 1 hour
        return "high_frequency_trading"
    
    if has_burst_activity(sent, received):
        return "burst_pattern"
```

### Network Analysis
```python
def analyze_network_patterns(sent, received):
    unique_sent = len(set(tx['to'] for tx in sent))
    unique_received = len(set(tx['from'] for tx in received))
    
    ratio = unique_sent / max(unique_received, 1)
    
    if ratio > 10:
        return "mixer_like_behavior"
```

### Value Analysis
```python
def analyze_value_patterns(sent, received):
    sent_values = [float(tx['value']) for tx in sent]
    received_values = [float(tx['value']) for tx in received]
    
    if std_dev(sent_values) < mean(sent_values) * 0.1:
        return "uniform_value_pattern"
```

## Integration Points

### Input Sources
- `AlchemyService`: Real-time blockchain data
- `OpenSearchService`: Historical fraud patterns
- `FeatureExtractor`: Normalized feature vectors

### Output Consumers
- API response formatting
- Logging and monitoring
- Analytics dashboard

## Performance Considerations

### Optimization Strategies
- Async pattern analysis
- Cached OpenAI responses
- Parallel node execution where possible
- Early termination for obvious cases

### Timeouts
- Per-node timeout: 30 seconds
- Total pipeline timeout: 2 minutes
- OpenAI API timeout: 20 seconds

## Error Handling

### Fallback Strategies
1. OpenAI API failure → Use rule-based analysis
2. Missing account data → Use KNN only
3. Invalid features → Return low confidence score

### Logging
- All node transitions logged
- Pattern detection results logged
- Confidence adjustments tracked

## Testing Considerations

### Test Cases
- Known fraud addresses
- Known legitimate addresses
- Edge cases (new accounts, dormant accounts)
- High-volume traders
- Contract deployers

### Validation Metrics
- Precision/Recall
- False positive rate
- Confidence calibration
- Response time

## References
- #[[file:app/services/rag_service.py]]
- #[[file:ARCHITECTURE.md]]
