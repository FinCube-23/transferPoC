# API Endpoint Comparison

## Before vs After Refactoring

### ✅ What Stayed the Same

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check (unchanged) |

### 🔄 What Changed

| Old Endpoint | New Endpoint | Method | Description |
|-------------|--------------|--------|-------------|
| `/stats` | `/data/stats` | GET | Database statistics |
| `/scrape` | `/data/scrape` | POST | Load training data |
| `/index` | `/data/index` | DELETE | Delete database |
| `/score` | `/fraud/score` | POST | Check address for fraud |

## Quick Reference

### Health & Status

```bash
# Health check (unchanged)
GET /
GET /health

Response:
{
  "service": "Ethereum Fraud Detection",
  "status": "running",
  "version": "1.0.0"
}
```

### Data Management

```bash
# Get database stats
GET /data/stats

Response:
{
  "exists": true,
  "document_count": 9841,
  "size_in_bytes": 2456789
}

# Load training data
POST /data/scrape
{
  "source_url": "vagifa/ethereum-frauddetection-dataset",
  "source_type": "kaggle"
}

Response:
{
  "status": "started",
  "message": "Data scraping started in background"
}

# Delete database index
DELETE /data/index

Response:
{
  "status": "success",
  "message": "Index deleted"
}
```

### Fraud Detection

```bash
# Score an address
POST /fraud/score
{
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}

Response:
{
  "result": "True|False|Undecided",
  "address": "0x...",
  "fraud_probability": 0.85,
  "confidence": 0.92,
  "knn_analysis": {...},
  "rag_analysis": {...},
  "features_extracted": {...}
}
```

## Migration Examples

### cURL

```bash
# Before
curl http://localhost:8000/stats
curl -X POST http://localhost:8000/score -d '{"address":"0x..."}'

# After
curl http://localhost:8000/data/stats
curl -X POST http://localhost:8000/fraud/score -d '{"address":"0x..."}'
```

### Python

```python
# Before
import requests

response = requests.get("http://localhost:8000/stats")
response = requests.post("http://localhost:8000/score", 
                        json={"address": "0x..."})

# After
import requests

response = requests.get("http://localhost:8000/data/stats")
response = requests.post("http://localhost:8000/fraud/score", 
                        json={"address": "0x..."})
```

### JavaScript

```javascript
// Before
const stats = await fetch('http://localhost:8000/stats');
const result = await fetch('http://localhost:8000/score', {
  method: 'POST',
  body: JSON.stringify({address: '0x...'})
});

// After
const stats = await fetch('http://localhost:8000/data/stats');
const result = await fetch('http://localhost:8000/fraud/score', {
  method: 'POST',
  body: JSON.stringify({address: '0x...'})
});
```

## Interactive API Documentation

FastAPI automatically generates interactive docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

These are updated automatically with the new endpoints!

## Benefits of New Structure

### 1. Logical Grouping
- `/data/*` - All data management operations
- `/fraud/*` - All fraud detection operations
- `/` - Health and status

### 2. Clearer Purpose
```bash
# Old (unclear what /stats does)
GET /stats

# New (clearly data-related)
GET /data/stats
```

### 3. Easier to Extend
```bash
# Adding new fraud-related endpoints
POST /fraud/score          # Check single address
POST /fraud/batch          # Check multiple addresses
GET  /fraud/history        # Get scoring history
POST /fraud/report         # Report false positive

# Adding new data-related endpoints
GET  /data/stats           # Database statistics
POST /data/scrape          # Load data
POST /data/export          # Export data
GET  /data/sources         # List data sources
```

### 4. Better API Versioning
```bash
# Future: Add versioning
/api/v1/fraud/score
/api/v2/fraud/score
```

## Backward Compatibility Option

If you need to support old endpoints temporarily:

```python
# app/main.py

# Legacy endpoints (deprecated)
@app.get("/stats", deprecated=True, tags=["deprecated"])
async def stats_legacy():
    """Deprecated: Use /data/stats instead"""
    return await data.get_stats()

@app.post("/score", deprecated=True, tags=["deprecated"])
async def score_legacy(request: ScoreRequest):
    """Deprecated: Use /fraud/score instead"""
    return await fraud.score_address(request)
```

This will:
- Keep old endpoints working
- Mark them as deprecated in docs
- Give users time to migrate

## Summary

The new structure is:
- ✅ More organized
- ✅ Easier to understand
- ✅ Better for scaling
- ✅ Follows REST conventions
- ✅ Professional and production-ready

Update your code to use the new endpoints!
