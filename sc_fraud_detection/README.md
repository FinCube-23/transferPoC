# Ethereum Fraud Detection Service.

RAG-based fraud detection service using K-NN similarity search and Gemini AI for Ethereum addresses.

## Architecture

```
User Request → Alchemy API → Feature Extraction → K-NN Search (OpenSearch) → RAG Analysis (Gemini) → Result
```

### Components

1. **Data Scraper**: Generic scraper supporting Kaggle, CSV, and JSON sources
2. **Alchemy Service**: Fetches real-time Ethereum account data
3. **Feature Extractor**: Converts raw data to 44-dimensional feature vectors
4. **OpenSearch**: Vector database with K-NN search capabilities
5. **K-NN Service**: Analyzes nearest neighbors for fraud probability
6. **RAG Service**: LangChain/LangGraph workflow with Gemini for edge case detection


## 📚 Documentation

### For Users
- **QUICKSTART.md**: Get started in 5 minutes
- **USAGE_EXAMPLES.md**: Code examples in Python, JS, curl
- **README.md**: Complete user guide

### For Developers
- **ARCHITECTURE.md**: System design & components
- **PROJECT_STRUCTURE.md**: Project structure.

### For Operations
- **docker-compose.yml**: Service configuration
- **README.md**: Monitoring & troubleshooting



## How It Works

### 1. Feature Extraction

When you query an address, the service:
- Fetches all transactions via Alchemy API
- Calculates 44 features matching the Kaggle dataset:
  - Transaction counts and patterns
  - Value statistics (min, max, avg)
  - Timing patterns
  - ERC20 token interactions
  - Unique address counts
  - Contract interactions

### 2. K-NN Search

- Converts features to a 44-dimensional vector
- Performs K-NN search in OpenSearch (default k=10)
- Calculates weighted fraud probability based on nearest neighbors
- Uses inverse distance weighting for confidence

### 3. RAG Analysis (LangGraph Workflow)

```
Input → Analyze K-NN → Detect Edge Cases → Final Decision → Output
```

**Node 1: Analyze K-NN**
- Gemini analyzes K-NN results and features
- Provides initial fraud assessment

**Node 2: Detect Edge Cases**
- Identifies unusual patterns:
  - High volume with low balance
  - Imbalanced transaction ratios
  - Large value movements
  - Rapid activity bursts
  - Heavy ERC20 usage
  - Low K-NN confidence

**Node 3: Final Decision**
- Gemini makes final determination
- Considers K-NN results + edge cases
- Provides reasoning and confidence score

### 4. Decision Logic

```
IF confidence < 0.4 → "Undecided"
ELSE IF fraud_probability >= 0.5 → "True" (Fraud)
ELSE IF fraud_probability < 0.5 → "False" (Not Fraud)
ELSE → "Undecided"
```

## Configuration

Edit `.env` or `docker-compose.yml`:

```env
# K-NN parameters
KNN_NEIGHBORS=10              # Number of neighbors to consider
CONFIDENCE_THRESHOLD=0.7      # Minimum confidence for decision

# OpenSearch
OPENSEARCH_HOST=opensearch
OPENSEARCH_PORT=9200
INDEX_NAME=fraud_detection_vectors
```




## Performance

- **API Response Time**: 5-15 seconds per address
  - Alchemy API calls: 2-5s
  - Feature extraction: <1s
  - K-NN search: <1s
  - RAG analysis: 2-8s

- **Throughput**: ~4-12 requests/minute (limited by Alchemy + Gemini rate limits)

- **Database**: Can handle millions of vectors with sub-second K-NN search

## Optimization Tips

1. **Caching**: Cache Alchemy results for frequently queried addresses
2. **Batch Processing**: Process multiple addresses in parallel
3. **Index Tuning**: Adjust OpenSearch K-NN parameters for speed/accuracy tradeoff
4. **Rate Limiting**: Implement rate limiting for API endpoints

## Troubleshooting

### OpenSearch won't start
```bash
# Increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144
```

### No data in database
```bash
# Check if index exists
curl http://localhost:9200/fraud_detection_vectors

# Reinitialize
docker-compose exec api python scripts/init_db.py
```

### Alchemy API errors
- Check API key is valid
- Verify rate limits not exceeded
- Ensure address format is correct (0x...)

### Gemini API errors
- Verify Google API key
- Check API quota
- Ensure gemini-pro model is enabled

## License

MIT

## Contributing

Pull requests welcome! Please ensure:
- Code follows existing style
- Tests pass
- Documentation updated


## 🔍 What Makes This Special

### 1. Hybrid Approach
- **K-NN**: Fast, data-driven similarity search
- **RAG**: Intelligent edge case handling
- **Best of both**: Accuracy + explainability

### 2. Edge Case Detection
Identifies 6 types of unusual patterns:
1. High volume + low balance (mixers/tumblers)
2. Imbalanced transaction ratios
3. Large value movements
4. Rapid activity bursts (bots)
5. Low K-NN confidence (novel patterns)
6. Heavy ERC20 usage (DeFi/traders)

### 3. Explainable Results
- Not just "fraud" or "not fraud"
- Detailed reasoning from Gemini
- Confidence scores
- Nearest neighbor analysis
- Feature breakdown

### 4. Production Ready
- Docker deployment
- Error handling
- Logging
- Health checks
- Background tasks
- Async operations

### 5. Extensible Design
- Generic scraper (easy to add sources)
- Modular services
- Clear separation of concerns
- Well-documented code



## 📈 Accuracy & Reliability

### K-NN Baseline
- Depends on training data quality
- Kaggle dataset: ~10,000 labeled addresses
- Weighted probability for better accuracy

### RAG Enhancement
- Catches edge cases K-NN misses
- Provides reasoning for decisions
- Adjusts confidence based on patterns

### Confidence Scoring
- **High (>0.8)**: Strong pattern match
- **Medium (0.5-0.8)**: Moderate confidence
- **Low (<0.5)**: Uncertain, returns "Undecided"

### Honest Uncertainty
- Returns "Undecided" when not confident
- Better than false positives/negatives
- Allows human review of edge cases

---

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Modern async Python framework
- **Pydantic**: Data validation
- **httpx**: Async HTTP client

### AI/ML
- **LangChain**: LLM framework
- **LangGraph**: Workflow orchestration
- **Gemini**: Google's LLM
- **scikit-learn**: ML utilities

### Database
- **OpenSearch**: Vector database
- **HNSW**: K-NN algorithm

### Infrastructure
- **Docker**: Containerization
- **Docker Compose**: Orchestration

---


## Test it out
```
Non-fraud (well-known/public EOAs with benign usage)
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 (Vitalik)

Fraud-like behavior (mixers/sanctioned infra; contracts, but good for anomaly patterns)
0x000e001ab444fa8d6dc4a402f8d7cfc88fe8c64d
```