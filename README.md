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

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose
- Alchemy API key
- Google API key (for Gemini)
- Kaggle credentials (optional, for data scraping)

### 2. Setup

```bash
# Clone repository
cd fraud-detection-service

# Create .env file
cp .env.example .env

# Edit .env with your API keys
nano .env
```

Required environment variables:
```env
ALCHEMY_API_KEY=your_alchemy_key
GOOGLE_API_KEY=your_google_key
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_key
```

### 3. Start Services

```bash
# Start OpenSearch and API
docker-compose up -d

# Check logs
docker-compose logs -f api
```

The API will be available at `http://localhost:8000`

### 4. Load Training Data

Option A: Using the API endpoint
```bash
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "vagifa/ethereum-frauddetection-dataset",
    "source_type": "kaggle"
  }'
```

Option B: Using the initialization script
```bash
docker-compose exec api python scripts/init_db.py
```

### 5. Check Status

```bash
curl http://localhost:8000/stats
```

## API Endpoints

### POST /score

Score an Ethereum address for fraud probability.

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**Response:**
```json
{
  "result": "True|False|Undecided",
  "address": "0x1234...",
  "fraud_probability": 0.85,
  "confidence": 0.92,
  "knn_analysis": {
    "fraud_probability": 0.85,
    "nearest_neighbors": [...],
    "avg_distance": 0.23
  },
  "rag_analysis": {
    "reasoning": "Account shows patterns consistent with...",
    "confidence": 0.92,
    "edge_cases_detected": [
      "High transaction volume with minimal balance"
    ]
  },
  "features_extracted": {
    "Sent tnx": 150,
    "Received Tnx": 45,
    ...
  }
}
```

### POST /scrape

Load data from external source into vector database.

**Request:**
```json
{
  "source_url": "vagifa/ethereum-frauddetection-dataset",
  "source_type": "kaggle"
}
```

Supported source types:
- `kaggle`: Kaggle dataset identifier
- `csv_url`: Direct CSV file URL
- `json_url`: Direct JSON API URL

### GET /stats

Get database statistics.

**Response:**
```json
{
  "exists": true,
  "document_count": 9841,
  "size_in_bytes": 2456789
}
```

### DELETE /index

Delete the vector database index (use with caution).

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

## Development

### Local Development (without Docker)

```bash
# Install dependencies
pip install -r requirements.txt

# Start OpenSearch
docker-compose up opensearch -d

# Set environment variables
export OPENSEARCH_HOST=localhost
export ALCHEMY_API_KEY=your_key
export GOOGLE_API_KEY=your_key

# Run API
uvicorn app.main:app --reload
```

### Testing

```bash
# Test with a known address
curl -X POST "http://localhost:8000/score" \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'
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
