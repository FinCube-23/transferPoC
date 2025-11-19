---
title: Fraud Detection System
status: implemented
created: 2024-11-19
---

# Fraud Detection System

## Overview
A comprehensive fraud detection system that analyzes Ethereum addresses using machine learning (KNN), RAG-based analysis, and real-time blockchain data from Alchemy API.

## Architecture

### Core Components

1. **API Layer** (`app/api/`)
   - FastAPI-based REST API
   - Routes: health, fraud scoring, data management
   - Dependency injection for services

2. **Services** (`app/services/`)
   - `AlchemyService`: Blockchain data retrieval
   - `OpenSearchService`: Vector similarity search (KNN)
   - `RAGService`: LangGraph-based fraud analysis
   - `KNNService`: Neighbor analysis

3. **Feature Engineering** (`app/utils/`)
   - `FeatureExtractor`: Extracts 47 features from blockchain data
   - Feature normalization and scaling

4. **Data Ingestion** (`app/scraper/`)
   - CSV upload and processing
   - Bulk data insertion into OpenSearch

## Key Features

### 1. Address Scoring
- **Endpoint**: `POST /api/fraud/score`
- **Process**:
  1. Fetch account data from Alchemy
  2. Extract 47 features
  3. Normalize feature vector
  4. KNN search in OpenSearch
  5. RAG-based pattern analysis
  6. Generate fraud score and explanation

### 2. Data Management
- **CSV Upload**: `POST /api/data/upload`
- **Index Stats**: `GET /api/data/stats`
- **Delete Index**: `DELETE /api/data/index`

### 3. RAG Analysis Pipeline
Multi-stage LangGraph workflow:
- KNN neighbor analysis
- Deep pattern detection
- Cross-validation
- Edge case detection
- Final decision synthesis

## Feature Set (47 features)

### Transaction Features
- Sent/received transaction counts
- Time differences between transactions
- Unique addresses (sent to/received from)

### Value Features
- Min/max/avg values (sent/received)
- Contract interaction values
- Total ether balance

### ERC20 Token Features
- Token transaction counts
- Unique token addresses
- Token value statistics
- Token type analysis

## Dependencies

### External Services
- **Alchemy API**: Ethereum blockchain data
- **OpenSearch**: Vector database for KNN
- **OpenAI API**: RAG analysis

### Python Packages
- FastAPI, Pydantic
- opensearch-py
- aiohttp
- langgraph, langchain
- pandas, numpy, scikit-learn

## Configuration

Environment variables (`.env`):
```
ALCHEMY_API_KEY=your_key
OPENSEARCH_HOST=localhost
OPENSEARCH_PORT=9200
OPENSEARCH_INDEX=fraud_detection
OPENAI_API_KEY=your_key
```

## Deployment

Docker-based deployment:
- FastAPI application
- OpenSearch cluster
- Docker Compose orchestration

## API Response Format

```json
{
  "address": "0x...",
  "fraud_score": 0.75,
  "risk_level": "high",
  "knn_analysis": {
    "fraud_percentage": 80.0,
    "neighbors_analyzed": 10
  },
  "rag_analysis": {
    "reasoning": "...",
    "confidence": 0.85,
    "key_findings": [...]
  }
}
```

## References
- #[[file:ARCHITECTURE.md]]
- #[[file:QUICKSTART.md]]
- #[[file:USAGE_EXAMPLES.md]]
