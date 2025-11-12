# Quick Start Guide

Get the fraud detection service running in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Alchemy API key ([Get one here](https://www.alchemy.com/))
- Google API key for Gemini ([Get one here](https://makersuite.google.com/app/apikey))
- (Optional) Kaggle credentials for data scraping

## Step 1: Configure Environment (1 min)

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env
```

Minimum required:
```env
ALCHEMY_API_KEY=your_alchemy_key_here
GOOGLE_API_KEY=your_google_key_here
```

For data scraping, also add:
```env
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_key
```

## Step 2: Start Services (1 min)

```bash
# Start OpenSearch and API
docker compose up -d --build

# Check if services are running
docker compose ps

# View logs
docker compose logs -f api
```

Wait for: `INFO: Application startup complete`

## Step 3: Load Training Data (2-3 min)

```bash
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "vagifa/ethereum-frauddetection-dataset",
    "source_type": "kaggle"
  }'
```

## Step 4: Test the API (30 sec)

```bash
# Check service health
curl http://localhost:8000/

# Check database stats
curl http://localhost:8000/stats

# Score an address (replace with real address)
curl -X POST "http://localhost:8000/score" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef1234567890abcdef12345678"
  }' | jq .
```

## Expected Response

```json
{
  "result": "True",
  "address": "0x1234...",
  "fraud_probability": 0.85,
  "confidence": 0.92,
  "knn_analysis": {
    "fraud_probability": 0.85,
    "nearest_neighbors": [...],
    "avg_distance": 0.23
  },
  "rag_analysis": {
    "reasoning": "Account shows patterns consistent with fraudulent behavior...",
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

## You're Done! 🎉

The service is now running and ready to detect fraud.

## Common Issues

### Issue: "Connection refused" to OpenSearch

**Solution**: Wait 30 seconds for OpenSearch to start
```bash
docker-compose logs opensearch
# Wait for: "Node started"
```

### Issue: "No data in vector database"

**Solution**: Scrape the dataset
```bash
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "vagifa/ethereum-frauddetection-dataset",
    "source_type": "kaggle"
  }'
```

### Issue: Kaggle authentication error

**Solution**: Get your Kaggle API credentials
1. Go to https://www.kaggle.com/
2. Click on your profile → Account
3. Scroll to "API" section
4. Click "Create New API Token"
5. Add credentials to `.env`

### Issue: Alchemy API error

**Solution**: Verify your API key
1. Check key is correct in `.env`
2. Ensure you're using the correct network (mainnet)
3. Check rate limits at https://dashboard.alchemy.com/

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) for more examples
- Review [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for architecture details


## API Endpoints

- `GET /` - Health check
- `GET /stats` - Database statistics
- `POST /score` - Score an address for fraud
- `POST /scrape` - Load data from external source
- `DELETE /index` - Delete database index

## Support

For issues or questions:
1. Check logs: `docker compose logs -f api`
2. Verify services: `docker compose ps`
3. Check OpenSearch: `curl http://localhost:9200/_cluster/health`
4. Review documentation in README.md
