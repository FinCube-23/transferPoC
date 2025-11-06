# Setup Guide

Complete setup instructions for the Ethereum Fraud Detection Service.

## System Requirements

### Minimum
- **OS**: Linux, macOS, or Windows with WSL2
- **RAM**: 2GB available
- **Disk**: 5GB free space
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### Recommended
- **RAM**: 4GB available
- **Disk**: 10GB free space
- **CPU**: 2+ cores

## Installation Steps

### 1. Install Docker

#### Linux (Ubuntu/Debian)
```bash
# Update package index
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

#### macOS
```bash
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Or use Homebrew
brew install --cask docker

# Start Docker Desktop
open -a Docker

# Verify installation
docker --version
docker compose version
```

#### Windows (WSL2)
```bash
# Install Docker Desktop for Windows
# Download from: https://www.docker.com/products/docker-desktop

# Enable WSL2 backend in Docker Desktop settings

# In WSL2 terminal, verify:
docker --version
docker compose version
```

### 2. Get API Keys

#### Alchemy API Key

1. Go to [https://www.alchemy.com/](https://www.alchemy.com/)
2. Sign up for free account
3. Create new app:
   - Chain: Ethereum
   - Network: Mainnet
4. Copy API key from dashboard

**Free Tier**: 300M compute units/month (enough for ~1.28M address checks)

#### Google API Key (Gemini)

1. Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the generated key

**Free Tier**: 60 requests/minute

#### Kaggle Credentials (Optional)

1. Go to [https://www.kaggle.com/](https://www.kaggle.com/)
2. Sign up/login
3. Go to Account settings
4. Scroll to "API" section
5. Click "Create New API Token"
6. Download `kaggle.json`
7. Extract username and key from file

### 3. Clone/Setup Project

```bash
# Create project directory
mkdir fraud-detection-service
cd fraud-detection-service

# Copy all project files here
# (or clone from git repository)

# Verify files
ls -la
# Should see: docker-compose.yml, Dockerfile, requirements.txt, app/, etc.
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env
# or
vim .env
# or
code .env
```

**Required variables**:
```env
ALCHEMY_API_KEY=your_alchemy_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
```

**Optional variables** (for data scraping):
```env
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_api_key
```

**Advanced configuration**:
```env
# OpenSearch settings
OPENSEARCH_HOST=opensearch
OPENSEARCH_PORT=9200
INDEX_NAME=fraud_detection_vectors

# K-NN parameters
KNN_NEIGHBORS=10
CONFIDENCE_THRESHOLD=0.7

# Feature dimensions
FEATURE_DIM=44
```

### 5. Increase System Limits (Linux only)

OpenSearch requires higher vm.max_map_count:

```bash
# Temporary (until reboot)
sudo sysctl -w vm.max_map_count=262144

# Permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 6. Start Services

```bash
# Pull images and start services
docker-compose up -d

# Check status
docker-compose ps

# Expected output:
# NAME                          STATUS
# fraud-detection-api           Up
# fraud-detection-opensearch    Up

# View logs
docker-compose logs -f
```

**Wait for services to be ready**:
- OpenSearch: "Node started" in logs
- API: "Application startup complete" in logs

### 7. Initialize Database

```bash
# Run initialization script
docker-compose exec api python scripts/init_db.py

# This will:
# 1. Create OpenSearch index
# 2. Download Kaggle dataset (~3MB)
# 3. Process ~10,000 records
# 4. Load into vector database

# Expected time: 2-3 minutes
```

**Expected output**:
```
INFO: Creating OpenSearch index...
INFO: Scraping Kaggle dataset...
INFO: Processing 9841 records...
INFO: Inserting 9841 records into OpenSearch...
✓ Database initialization complete!
  - Successfully inserted: 9841
  - Failed: 0
  - Total documents: 9841
```

### 8. Verify Installation

```bash
# Test health endpoint
curl http://localhost:8000/

# Expected: {"service": "Ethereum Fraud Detection", "status": "running"}

# Check database stats
curl http://localhost:8000/stats

# Expected: {"exists": true, "document_count": 9841, ...}

# Test fraud detection (replace with real address)
curl -X POST "http://localhost:8000/score" \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234567890abcdef1234567890abcdef12345678"}' \
  | jq .
```

## Troubleshooting

### Issue: Docker daemon not running

**Error**: `Cannot connect to the Docker daemon`

**Solution**:
```bash
# Linux
sudo systemctl start docker

# macOS/Windows
# Start Docker Desktop application
```

### Issue: Port already in use

**Error**: `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Solution**:
```bash
# Find process using port
sudo lsof -i :8000
# or
sudo netstat -tulpn | grep 8000

# Kill process
sudo kill -9 <PID>

# Or change port in docker-compose.yml
# ports:
#   - "8001:8000"  # Use 8001 instead
```

### Issue: OpenSearch won't start

**Error**: `max virtual memory areas vm.max_map_count [65530] is too low`

**Solution**:
```bash
# Increase limit
sudo sysctl -w vm.max_map_count=262144

# Make permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

### Issue: Out of memory

**Error**: `OpenSearch killed` or `Container exited with code 137`

**Solution**:
```bash
# Reduce OpenSearch memory in docker-compose.yml
# Change:
# OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
# To:
# OPENSEARCH_JAVA_OPTS=-Xms256m -Xmx256m

# Restart
docker-compose restart opensearch
```

### Issue: Kaggle authentication failed

**Error**: `401 Unauthorized` when scraping

**Solution**:
1. Verify credentials in `.env`
2. Check kaggle.json format:
   ```json
   {"username":"your_username","key":"your_key"}
   ```
3. Ensure Kaggle account is verified (phone number)

### Issue: Alchemy API errors

**Error**: `Invalid API key` or `Rate limit exceeded`

**Solution**:
```bash
# Verify API key
echo $ALCHEMY_API_KEY

# Check dashboard
# https://dashboard.alchemy.com/

# For rate limits, wait or upgrade plan
```

### Issue: Gemini API errors

**Error**: `API key not valid` or `Quota exceeded`

**Solution**:
```bash
# Verify API key
echo $GOOGLE_API_KEY

# Check quota
# https://makersuite.google.com/app/apikey

# Ensure gemini-pro model is enabled
```

### Issue: Database initialization fails

**Error**: Various errors during `init_db.py`

**Solution**:
```bash
# Check OpenSearch is running
curl http://localhost:9200/_cluster/health

# Delete and recreate index
curl -X DELETE http://localhost:8000/index

# Try again
docker-compose exec api python scripts/init_db.py

# Check logs for specific errors
docker-compose logs api
```

## Verification Checklist

- [ ] Docker and Docker Compose installed
- [ ] API keys obtained and configured in `.env`
- [ ] Services started: `docker-compose ps` shows "Up"
- [ ] OpenSearch healthy: `curl http://localhost:9200/_cluster/health`
- [ ] API healthy: `curl http://localhost:8000/`
- [ ] Database initialized: `curl http://localhost:8000/stats` shows documents
- [ ] Test request works: `POST /score` returns valid response

## Next Steps

Once setup is complete:

1. **Read Documentation**
   - [README.md](README.md) - Full documentation
   - [QUICKSTART.md](QUICKSTART.md) - Quick start guide
   - [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) - Usage examples

2. **Test the API**
   ```bash
   ./test_api.sh
   ```

3. **Try Examples**
   - Check Python examples in USAGE_EXAMPLES.md
   - Test with real Ethereum addresses
   - Experiment with different addresses

4. **Monitor Performance**
   ```bash
   # Watch logs
   docker-compose logs -f api
   
   # Check resource usage
   docker stats
   ```

5. **Customize Configuration**
   - Adjust K-NN parameters in `.env`
   - Tune OpenSearch settings
   - Configure rate limiting

## Production Setup

For production deployment:

### 1. Security

```bash
# Enable OpenSearch security
# Edit docker-compose.yml:
# DISABLE_SECURITY_PLUGIN=false

# Add API authentication
# Implement in app/main.py

# Use secrets management
# Don't commit .env file
```

### 2. Performance

```bash
# Increase resources in docker-compose.yml
# OpenSearch:
# OPENSEARCH_JAVA_OPTS=-Xms2g -Xmx2g

# API:
# command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 3. Monitoring

```bash
# Add monitoring stack
# - Prometheus for metrics
# - Grafana for dashboards
# - ELK for logs
```

### 4. Backup

```bash
# Backup OpenSearch data
docker-compose exec opensearch \
  curl -X PUT "localhost:9200/_snapshot/backup" \
  -H 'Content-Type: application/json' \
  -d '{"type": "fs", "settings": {"location": "/backup"}}'
```

### 5. Reverse Proxy

```bash
# Use nginx for SSL/TLS
# Example nginx.conf:
server {
    listen 443 ssl;
    server_name fraud-detection.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Uninstallation

To completely remove the service:

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (deletes all data)
docker-compose down -v

# Remove images
docker rmi fraud-detection-service-api
docker rmi opensearchproject/opensearch:2.11.0

# Remove project directory
cd ..
rm -rf fraud-detection-service
```

## Support

If you encounter issues:

1. Check logs: `docker-compose logs -f`
2. Verify configuration: `cat .env`
3. Check service status: `docker-compose ps`
4. Review documentation
5. Check API keys are valid
6. Ensure system requirements are met

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [OpenSearch Documentation](https://opensearch.org/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Alchemy Documentation](https://docs.alchemy.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
