---
title: API Endpoints Specification
status: implemented
created: 2024-11-19
---

# API Endpoints Specification

## Base URL
```
http://localhost:8000
```

## Endpoints Overview

### Health & Status
- `GET /` - Root endpoint
- `GET /health` - Health check

### Fraud Detection
- `POST /api/fraud/score` - Score an address for fraud

### Data Management
- `POST /api/data/upload` - Upload CSV training data
- `GET /api/data/stats` - Get index statistics
- `DELETE /api/data/index` - Delete OpenSearch index

---

## Endpoint Details

### 1. Root Endpoint

**GET /**

Returns API information and available endpoints.

**Response**: `200 OK`
```json
{
  "message": "Fraud Detection API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "fraud_score": "/api/fraud/score",
    "upload_data": "/api/data/upload",
    "stats": "/api/data/stats"
  }
}
```

---

### 2. Health Check

**GET /health**

Check API and service health status.

**Response**: `200 OK`
```json
{
  "status": "healthy",
  "services": {
    "alchemy": "connected",
    "opensearch": "connected",
    "rag": "ready"
  },
  "timestamp": "2024-11-19T10:30:00Z"
}
```

**Error Response**: `503 Service Unavailable`
```json
{
  "status": "unhealthy",
  "services": {
    "alchemy": "connected",
    "opensearch": "disconnected",
    "rag": "ready"
  },
  "error": "OpenSearch connection failed"
}
```

---

### 3. Score Address for Fraud

**POST /api/fraud/score**

Analyze an Ethereum address and return fraud risk score.

**Request Body**:
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Validation**:
- `address` must be valid Ethereum address (0x + 40 hex chars)
- Required field

**Response**: `200 OK`
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "fraud_score": 0.75,
  "risk_level": "high",
  "confidence": 0.85,
  "knn_analysis": {
    "fraud_percentage": 80.0,
    "neighbors_analyzed": 10,
    "average_distance": 0.23,
    "closest_fraud_distance": 0.15
  },
  "rag_analysis": {
    "reasoning": "Address exhibits high-frequency trading patterns with multiple unique recipients, similar to known mixer behavior. Token activity shows concentration in few token types.",
    "key_findings": [
      "High transaction frequency (avg 15 min between txs)",
      "80% of similar addresses are fraudulent",
      "Mixer-like behavior detected",
      "Low token diversity"
    ],
    "behavioral_flags": [
      "high_frequency_trading",
      "mixer_like_behavior"
    ],
    "pattern_analysis": {
      "temporal": "suspicious",
      "network": "high_risk",
      "value": "normal",
      "token": "suspicious"
    }
  },
  "features": {
    "total_transactions": 1250,
    "unique_sent_to": 450,
    "unique_received_from": 120,
    "total_ether_sent": 125.5,
    "total_ether_received": 130.2,
    "erc20_transactions": 850
  },
  "timestamp": "2024-11-19T10:30:00Z"
}
```

**Risk Levels**:
- `critical`: score ≥ 0.8
- `high`: 0.6 ≤ score < 0.8
- `medium`: 0.4 ≤ score < 0.6
- `low`: score < 0.4

**Error Responses**:

`400 Bad Request` - Invalid address format
```json
{
  "detail": "Invalid Ethereum address format"
}
```

`404 Not Found` - Address not found or no activity
```json
{
  "detail": "Address has no transaction history"
}
```

`500 Internal Server Error` - Service failure
```json
{
  "detail": "Failed to analyze address: OpenSearch connection error"
}
```

**Processing Time**: 2-5 seconds typical

---

### 4. Upload CSV Training Data

**POST /api/data/upload**

Upload CSV file containing fraud detection training data.

**Request**: `multipart/form-data`
- `file`: CSV file (required)

**CSV Format Requirements**:

**Required Columns** (at least 50% must be present):
- `Address` - Ethereum address
- `FLAG` - Fraud label (0 = legitimate, 1 = fraud)

**Optional Feature Columns** (47 total):
- Transaction features: `Sent tnx`, `Received Tnx`, etc.
- Temporal features: `Avg min between sent tnx`, etc.
- Value features: `min value received`, `max value received`, etc.
- ERC20 features: `Total ERC20 tnxs`, `ERC20 total Ether sent`, etc.

**Example CSV**:
```csv
Address,FLAG,Sent tnx,Received Tnx,total transactions,...
0x123...,1,450,120,570,...
0x456...,0,25,30,55,...
```

**Response**: `202 Accepted`
```json
{
  "message": "CSV upload started",
  "status": "processing",
  "filename": "fraud_data.csv",
  "estimated_time": "2-5 minutes",
  "job_id": "upload_20241119_103000"
}
```

**Background Processing**:
1. Validate CSV format
2. Extract features from each row
3. Normalize feature vectors
4. Bulk insert into OpenSearch
5. Update index statistics

**Progress Tracking**:
- Check `/api/data/stats` for updated record count

**Error Responses**:

`400 Bad Request` - Invalid CSV format
```json
{
  "detail": "CSV missing required columns: Address, FLAG"
}
```

`413 Payload Too Large` - File too large
```json
{
  "detail": "File size exceeds 100MB limit"
}
```

`422 Unprocessable Entity` - Invalid data
```json
{
  "detail": "Invalid feature values in row 45"
}
```

**File Size Limits**:
- Maximum: 100MB
- Recommended: < 50MB for faster processing

**Performance**:
- ~1000 records/second
- 10,000 records: ~10 seconds
- 100,000 records: ~2 minutes

---

### 5. Get Index Statistics

**GET /api/data/stats**

Retrieve OpenSearch index statistics.

**Response**: `200 OK`
```json
{
  "index_name": "fraud_detection",
  "total_records": 125000,
  "fraud_records": 45000,
  "legitimate_records": 80000,
  "fraud_percentage": 36.0,
  "index_size_mb": 450.5,
  "last_updated": "2024-11-19T09:15:00Z",
  "feature_dimension": 47,
  "knn_enabled": true
}
```

**Error Response**: `404 Not Found`
```json
{
  "detail": "Index does not exist"
}
```

---

### 6. Delete Index

**DELETE /api/data/index**

Delete the OpenSearch index and all data.

**Warning**: This operation is irreversible!

**Response**: `200 OK`
```json
{
  "message": "Index deleted successfully",
  "index_name": "fraud_detection",
  "records_deleted": 125000
}
```

**Error Response**: `404 Not Found`
```json
{
  "detail": "Index does not exist"
}
```

---

## Authentication

**Current**: No authentication (development only)

**Production Recommendations**:
- API key authentication
- Rate limiting
- IP whitelisting
- OAuth 2.0 for user-facing apps

---

## Rate Limiting

**Current**: No rate limiting

**Recommended Limits**:
- `/api/fraud/score`: 60 requests/minute
- `/api/data/upload`: 5 requests/hour
- `/api/data/stats`: 100 requests/minute

---

## CORS Configuration

**Allowed Origins**: `*` (development)

**Production**: Configure specific origins in `app/main.py`

---

## Error Response Format

All errors follow this structure:
```json
{
  "detail": "Error message",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-11-19T10:30:00Z"
}
```

**Common Error Codes**:
- `INVALID_ADDRESS`: Invalid Ethereum address
- `SERVICE_UNAVAILABLE`: External service down
- `INSUFFICIENT_DATA`: Not enough data for analysis
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

## Monitoring & Logging

### Request Logging
- All requests logged with timestamp
- Response time tracked
- Error rates monitored

### Metrics Endpoints
- Prometheus metrics: `/metrics` (if enabled)
- Health metrics: `/health`

---

## Testing

### Example cURL Commands

**Score Address**:
```bash
curl -X POST http://localhost:8000/api/fraud/score \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

**Upload CSV**:
```bash
curl -X POST http://localhost:8000/api/data/upload \
  -F "file=@fraud_data.csv"
```

**Get Stats**:
```bash
curl http://localhost:8000/api/data/stats
```

### Python Client Example
```python
import requests

# Score address
response = requests.post(
    "http://localhost:8000/api/fraud/score",
    json={"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}
)
result = response.json()
print(f"Fraud Score: {result['fraud_score']}")
```

---

## References
- #[[file:app/api/routes/fraud.py]]
- #[[file:app/api/routes/data.py]]
- #[[file:app/api/routes/health.py]]
- #[[file:USAGE_EXAMPLES.md]]
