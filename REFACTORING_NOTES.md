# Refactoring Notes - API Structure

## What Changed

The `app/main.py` was refactored from **260 lines** to **60 lines** by extracting endpoints into separate router modules.

## New Structure

```
app/
├── main.py                      # 60 lines - App setup & lifespan only
├── api/
│   ├── __init__.py
│   ├── deps.py                  # Dependency injection
│   └── routes/
│       ├── __init__.py
│       ├── health.py            # Health check endpoints
│       ├── data.py              # Data management endpoints
│       └── fraud.py             # Fraud detection endpoints
```

## Benefits

### 1. **Separation of Concerns**
- `health.py` - Health checks and status
- `data.py` - Data loading and database management
- `fraud.py` - Fraud detection logic

### 2. **Cleaner main.py**
```python
# Before: 260 lines with all endpoints
# After: 60 lines - just setup and routing
```

### 3. **Better Testability**
Each router can be tested independently:
```python
from app.api.routes import fraud

# Test just fraud detection
def test_score_endpoint():
    ...
```

### 4. **Follows FastAPI Best Practices**
- Uses `APIRouter` for modular routing
- Dependency injection via `Depends()`
- Clear separation of concerns

### 5. **Easier to Scale**
Adding new endpoints is simple:
```python
# app/api/routes/analytics.py
router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/trends")
async def get_trends():
    ...

# app/main.py
from app.api.routes import analytics
app.include_router(analytics.router)
```

## API Endpoint Changes

### Old URLs → New URLs

| Old Endpoint | New Endpoint | Router |
|-------------|--------------|--------|
| `GET /` | `GET /` | health.py |
| `GET /stats` | `GET /data/stats` | data.py |
| `POST /scrape` | `POST /data/scrape` | data.py |
| `DELETE /index` | `DELETE /data/index` | data.py |
| `POST /score` | `POST /fraud/score` | fraud.py |

**Note**: Root endpoint (`/`) stays the same for backward compatibility.

## Migration Guide

### For API Users

Update your API calls:

```bash
# Old
curl http://localhost:8000/stats
curl -X POST http://localhost:8000/scrape
curl -X POST http://localhost:8000/score
curl -X DELETE http://localhost:8000/index

# New
curl http://localhost:8000/data/stats
curl -X POST http://localhost:8000/data/scrape
curl -X POST http://localhost:8000/fraud/score
curl -X DELETE http://localhost:8000/data/index
```

### For Python Clients

```python
# Old
response = requests.post("http://localhost:8000/score", json={"address": "0x..."})

# New
response = requests.post("http://localhost:8000/fraud/score", json={"address": "0x..."})
```

### For JavaScript Clients

```javascript
// Old
await axios.post('http://localhost:8000/score', {address: '0x...'});

// New
await axios.post('http://localhost:8000/fraud/score', {address: '0x...'});
```

## Dependency Injection Pattern

### How It Works

```python
# 1. Services are initialized in main.py during startup
alchemy_service = AlchemyService(api_key)
opensearch_service = OpenSearchService(host, port)
rag_service = RAGService(api_key)

# 2. Services are registered in deps.py
deps.set_services(alchemy_service, opensearch_service, rag_service)

# 3. Routes inject services as dependencies
@router.post("/fraud/score")
async def score_address(
    request: ScoreRequest,
    alchemy_service: AlchemyService = Depends(get_alchemy_service),
    opensearch_service: OpenSearchService = Depends(get_opensearch_service),
    rag_service: RAGService = Depends(get_rag_service)
):
    # Use services here
    account_data = await alchemy_service.get_account_data(address)
```

### Benefits
- ✅ No global variables in route files
- ✅ Easy to mock for testing
- ✅ Clear dependencies
- ✅ Type hints work properly

## Testing Examples

### Test Individual Router

```python
from fastapi.testclient import TestClient
from app.api.routes import health

client = TestClient(health.router)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"
```

### Test with Mocked Services

```python
from unittest.mock import Mock
from app.api.routes import fraud
from app.api import deps

# Mock services
mock_alchemy = Mock()
mock_opensearch = Mock()
mock_rag = Mock()

deps.set_services(mock_alchemy, mock_opensearch, mock_rag)

# Test
client = TestClient(fraud.router)
response = client.post("/fraud/score", json={"address": "0x..."})
```

## File Sizes

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | 60 | App setup & routing |
| `deps.py` | 35 | Dependency injection |
| `health.py` | 25 | Health checks |
| `data.py` | 130 | Data management |
| `fraud.py` | 115 | Fraud detection |
| **Total** | **365** | (was 260 in one file) |

## Documentation Updates Needed

Update these files to reflect new endpoints:

- [ ] README.md - Update API endpoint examples
- [ ] USAGE_EXAMPLES.md - Update curl commands
- [ ] test_api.sh - Update endpoint URLs
- [ ] QUICKSTART.md - Update example commands

## Backward Compatibility

To maintain backward compatibility, you can add aliases:

```python
# app/main.py

# Legacy endpoints (deprecated)
@app.post("/score", deprecated=True)
async def score_address_legacy(request: ScoreRequest):
    """Deprecated: Use /fraud/score instead"""
    return await fraud.score_address(request)
```

## Future Improvements

1. **Add versioning**: `/api/v1/fraud/score`
2. **Add rate limiting**: Per endpoint or per user
3. **Add authentication**: API keys or JWT tokens
4. **Add caching**: Cache fraud scores for addresses
5. **Add webhooks**: Notify on fraud detection
6. **Add batch endpoint**: Score multiple addresses at once

## Summary

The refactoring improves:
- ✅ **Code organization** - Clear separation by feature
- ✅ **Maintainability** - Easier to find and modify code
- ✅ **Testability** - Test routers independently
- ✅ **Scalability** - Easy to add new endpoints
- ✅ **Best practices** - Follows FastAPI conventions

The API is now more professional and production-ready!
