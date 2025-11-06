# Setup Guide

Complete setup instructions for the Ethereum Fraud Detection Service.







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



### 5. Increase System Limits (Linux only)

OpenSearch requires higher vm.max_map_count:

```bash
# Temporary (until reboot)
sudo sysctl -w vm.max_map_count=262144

# Permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```


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
