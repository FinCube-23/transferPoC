# Usage Examples

## Setup and Initialization

### 1. Start the Service

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f api

# Wait for services to be ready (check health)
curl http://localhost:8000/
```

### 2. Load Training Data

```bash
# Method 1: Using API endpoint (runs in background)
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "vagifa/ethereum-frauddetection-dataset",
    "source_type": "kaggle"
  }'

# Method 2: Using init script (runs synchronously)
docker-compose exec api python scripts/init_db.py

# Check progress
docker-compose logs -f api

# Verify data loaded
curl http://localhost:8000/stats
```

## Fraud Detection Examples

### Example 1: Check a Single Address

```bash
curl -X POST "http://localhost:8000/score" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef1234567890abcdef12345678"
  }' | jq .
```

### Example 2: Python Client

```python
import requests
import json

API_URL = "http://localhost:8000"

def check_fraud(address: str):
    """Check if an address is fraudulent"""
    response = requests.post(
        f"{API_URL}/score",
        json={"address": address}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"Address: {result['address']}")
        print(f"Result: {result['result']}")
        print(f"Fraud Probability: {result['fraud_probability']:.2%}")
        print(f"Confidence: {result['confidence']:.2%}")
        print(f"\nReasoning: {result['rag_analysis']['reasoning']}")
        
        if result['rag_analysis']['edge_cases_detected']:
            print("\nEdge Cases Detected:")
            for case in result['rag_analysis']['edge_cases_detected']:
                print(f"  - {case}")
        
        return result
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

# Example usage
address = "0x1234567890abcdef1234567890abcdef12345678"
result = check_fraud(address)
```

### Example 3: Batch Processing

```python
import requests
import asyncio
import aiohttp
from typing import List, Dict

async def check_address_async(session, address: str) -> Dict:
    """Async check for an address"""
    async with session.post(
        "http://localhost:8000/score",
        json={"address": address}
    ) as response:
        return await response.json()

async def batch_check_fraud(addresses: List[str]):
    """Check multiple addresses in parallel"""
    async with aiohttp.ClientSession() as session:
        tasks = [check_address_async(session, addr) for addr in addresses]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results

# Example usage
addresses = [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0xabcdef1234567890abcdef1234567890abcdef12",
    "0x7890abcdef1234567890abcdef1234567890abcd"
]

results = asyncio.run(batch_check_fraud(addresses))

for addr, result in zip(addresses, results):
    if isinstance(result, dict):
        print(f"{addr}: {result['result']} ({result['fraud_probability']:.2%})")
    else:
        print(f"{addr}: Error - {result}")
```

### Example 4: JavaScript/Node.js Client

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:8000';

async function checkFraud(address) {
  try {
    const response = await axios.post(`${API_URL}/score`, {
      address: address
    });
    
    const result = response.data;
    
    console.log(`Address: ${result.address}`);
    console.log(`Result: ${result.result}`);
    console.log(`Fraud Probability: ${(result.fraud_probability * 100).toFixed(2)}%`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(2)}%`);
    console.log(`\nReasoning: ${result.rag_analysis.reasoning}`);
    
    if (result.rag_analysis.edge_cases_detected.length > 0) {
      console.log('\nEdge Cases Detected:');
      result.rag_analysis.edge_cases_detected.forEach(case => {
        console.log(`  - ${case}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}

// Example usage
const address = '0x1234567890abcdef1234567890abcdef12345678';
checkFraud(address);
```

## Data Management

### Load Data from Different Sources

```bash
# From Kaggle dataset
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "vagifa/ethereum-frauddetection-dataset",
    "source_type": "kaggle"
  }'

# From CSV URL
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://example.com/fraud_data.csv",
    "source_type": "csv_url"
  }'

# From JSON API
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://api.example.com/fraud-data",
    "source_type": "json_url"
  }'
```

### Check Database Status

```bash
# Get statistics
curl http://localhost:8000/stats | jq .

# Expected output:
# {
#   "exists": true,
#   "document_count": 9841,
#   "size_in_bytes": 2456789
# }
```

### Reset / Delete Database

```bash
# Delete index
curl -X DELETE "http://localhost:8000/index"

# Recreate and reload data
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "vagifa/ethereum-frauddetection-dataset",
    "source_type": "kaggle"
  }'
```

## Advanced Usage

### Custom K-NN Parameters

Edit `.env` file:

```env
KNN_NEIGHBORS=20              # Increase for more neighbors
CONFIDENCE_THRESHOLD=0.8      # Higher threshold for decisions
```

Restart service:
```bash
docker-compose restart api
```

### Direct OpenSearch Queries

```bash
# Query OpenSearch directly
curl -X GET "http://localhost:9200/fraud_detection_vectors/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match_all": {}
    },
    "size": 10
  }' | jq .
```

### Monitor Performance

```bash
# Watch API logs
docker-compose logs -f api

# Check OpenSearch stats
curl http://localhost:9200/_cat/indices?v

# Monitor resource usage
docker stats
```

## Interpreting Results

### Result Field Meanings

```json
{
  "result": "True",              // Final decision: True (fraud), False (not fraud), Undecided
  "fraud_probability": 0.85,     // 0-1 probability from K-NN (0.85 = 85% likely fraud)
  "confidence": 0.92,            // 0-1 confidence in decision (0.92 = 92% confident)
  
  "knn_analysis": {
    "fraud_probability": 0.85,   // Weighted probability from nearest neighbors
    "avg_distance": 0.23,        // Average distance to neighbors (lower = more similar)
    "nearest_neighbors": [...]   // Top 5 most similar accounts
  },
  
  "rag_analysis": {
    "reasoning": "...",          // Gemini's explanation
    "confidence": 0.92,          // RAG confidence score
    "edge_cases_detected": [     // Unusual patterns found
      "High transaction volume with minimal balance"
    ]
  }
}
```

### Decision Logic

- **True (Fraud)**: fraud_probability >= 0.5 AND confidence >= 0.4
- **False (Not Fraud)**: fraud_probability < 0.5 AND confidence >= 0.4
- **Undecided**: confidence < 0.4 OR probability near 0.5

### Confidence Interpretation

- **0.9-1.0**: Very high confidence - strong pattern match
- **0.7-0.9**: High confidence - good pattern match
- **0.5-0.7**: Moderate confidence - some uncertainty
- **0.3-0.5**: Low confidence - significant uncertainty
- **0.0-0.3**: Very low confidence - unreliable prediction

## Troubleshooting Examples


### Issue: Slow responses

```bash
# Check if OpenSearch is healthy
curl http://localhost:9200/_cluster/health

# Reduce K-NN neighbors for faster search
# Edit .env: KNN_NEIGHBORS=5
docker-compose restart api
```

### Issue: Alchemy API rate limit

```python
# Add retry logic
import time
from requests.exceptions import HTTPError

def check_with_retry(address, max_retries=3):
    for i in range(max_retries):
        try:
            response = requests.post(
                "http://localhost:8000/score",
                json={"address": address}
            )
            response.raise_for_status()
            return response.json()
        except HTTPError as e:
            if e.response.status_code == 429:  # Rate limit
                wait_time = 2 ** i  # Exponential backoff
                print(f"Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
    raise Exception("Max retries exceeded")
```

## Production Deployment

### Environment Variables for Production

```env
# Production settings
ALCHEMY_API_KEY=prod_key_here
GOOGLE_API_KEY=prod_key_here

# Increase resources
KNN_NEIGHBORS=15
CONFIDENCE_THRESHOLD=0.75

# OpenSearch production settings
OPENSEARCH_JAVA_OPTS=-Xms2g -Xmx2g
```

### Health Check Endpoint

```bash
# Add to monitoring
curl http://localhost:8000/ 

# Expected: {"service": "Ethereum Fraud Detection", "status": "running"}
```

### Backup Database

```bash
# Backup OpenSearch data
docker-compose exec opensearch \
  curl -X POST "localhost:9200/_snapshot/backup/snapshot_1?wait_for_completion=true"
```
