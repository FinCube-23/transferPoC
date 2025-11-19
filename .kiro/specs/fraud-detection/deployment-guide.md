---
title: Deployment Guide
status: implemented
created: 2024-11-19
---

# Deployment Guide

## Overview
Docker-based deployment for the fraud detection system with FastAPI backend and OpenSearch database.

## Architecture

```
┌─────────────────┐
│   FastAPI App   │ :8000
│  (fraud-api)    │
└────────┬────────┘
         │
         ├─────────────┐
         │             │
┌────────▼────────┐   │
│   OpenSearch    │   │
│   (opensearch)  │   │
│     :9200       │   │
└─────────────────┘   │
                      │
┌─────────────────────▼──┐
│   Alchemy API          │
│   (external)           │
└────────────────────────┘
```

## Prerequisites

### Required Software
- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 10GB+ disk space

### API Keys
- Alchemy API key (Ethereum)
- OpenAI API key (RAG analysis)

## Configuration

### 1. Environment Variables

Create `.env` file in `sc_fraud_detection/`:

```bash
# Alchemy Configuration
ALCHEMY_API_KEY=your_alchemy_api_key_here

# OpenSearch Configuration
OPENSEARCH_HOST=opensearch
OPENSEARCH_PORT=9200
OPENSEARCH_INDEX=fraud_detection

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Application Configuration
LOG_LEVEL=INFO
ENVIRONMENT=production
```

### 2. Docker Compose Configuration

File: `docker-compose.yml`

**Services**:

#### OpenSearch
```yaml
opensearch:
  image: opensearchproject/opensearch:2.11.0
  environment:
    - discovery.type=single-node
    - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
    - DISABLE_SECURITY_PLUGIN=true
  ports:
    - "9200:9200"
  volumes:
    - opensearch-data:/usr/share/opensearch/data
```

#### FastAPI Application
```yaml
fraud-api:
  build: .
  ports:
    - "8000:8000"
  environment:
    - ALCHEMY_API_KEY=${ALCHEMY_API_KEY}
    - OPENSEARCH_HOST=opensearch
    - OPENSEARCH_PORT=9200
    - OPENAI_API_KEY=${OPENAI_API_KEY}
  depends_on:
    - opensearch
```

### 3. Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Deployment Steps

### Local Development

**1. Start Services**
```bash
cd sc_fraud_detection
docker-compose up -d
```

**2. Check Status**
```bash
docker-compose ps
docker-compose logs -f fraud-api
```

**3. Verify Health**
```bash
curl http://localhost:8000/health
```

**4. Initialize Index**
```bash
# Upload training data
curl -X POST http://localhost:8000/api/data/upload \
  -F "file=@training_data.csv"
```

### Production Deployment

#### Option 1: Docker Swarm

**1. Initialize Swarm**
```bash
docker swarm init
```

**2. Deploy Stack**
```bash
docker stack deploy -c docker-compose.yml fraud-detection
```

**3. Scale Services**
```bash
docker service scale fraud-detection_fraud-api=3
```

#### Option 2: Kubernetes

**1. Create Namespace**
```bash
kubectl create namespace fraud-detection
```

**2. Create Secrets**
```bash
kubectl create secret generic api-keys \
  --from-literal=alchemy-key=$ALCHEMY_API_KEY \
  --from-literal=openai-key=$OPENAI_API_KEY \
  -n fraud-detection
```

**3. Deploy OpenSearch**
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: opensearch
  namespace: fraud-detection
spec:
  serviceName: opensearch
  replicas: 1
  selector:
    matchLabels:
      app: opensearch
  template:
    metadata:
      labels:
        app: opensearch
    spec:
      containers:
      - name: opensearch
        image: opensearchproject/opensearch:2.11.0
        ports:
        - containerPort: 9200
        env:
        - name: discovery.type
          value: single-node
        volumeMounts:
        - name: data
          mountPath: /usr/share/opensearch/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
```

**4. Deploy API**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fraud-api
  namespace: fraud-detection
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fraud-api
  template:
    metadata:
      labels:
        app: fraud-api
    spec:
      containers:
      - name: fraud-api
        image: fraud-detection:latest
        ports:
        - containerPort: 8000
        env:
        - name: ALCHEMY_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: alchemy-key
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai-key
        - name: OPENSEARCH_HOST
          value: opensearch
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

**5. Create Service**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: fraud-api
  namespace: fraud-detection
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8000
  selector:
    app: fraud-api
```

## Monitoring

### Health Checks

**Liveness Probe**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
```

**Readiness Probe**:
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Logging

**View Logs**:
```bash
# Docker Compose
docker-compose logs -f fraud-api

# Kubernetes
kubectl logs -f deployment/fraud-api -n fraud-detection
```

**Log Aggregation**:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch (AWS)

### Metrics

**Prometheus Metrics**:
```python
# Add to app/main.py
from prometheus_fastapi_instrumentator import Instrumentator

@app.on_event("startup")
async def startup():
    Instrumentator().instrument(app).expose(app)
```

**Key Metrics**:
- Request rate
- Response time (p50, p95, p99)
- Error rate
- OpenSearch query time
- Alchemy API latency

## Scaling

### Horizontal Scaling

**API Instances**:
```bash
# Docker Compose
docker-compose up -d --scale fraud-api=3

# Kubernetes
kubectl scale deployment fraud-api --replicas=5 -n fraud-detection
```

**Load Balancing**:
- Nginx reverse proxy
- Kubernetes Service (LoadBalancer)
- AWS ALB/ELB

### Vertical Scaling

**Increase Resources**:
```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "2000m"
  limits:
    memory: "4Gi"
    cpu: "4000m"
```

### OpenSearch Scaling

**Cluster Setup**:
```yaml
opensearch:
  replicas: 3
  env:
    - discovery.seed_hosts=opensearch-0,opensearch-1,opensearch-2
    - cluster.initial_master_nodes=opensearch-0,opensearch-1,opensearch-2
```

## Backup & Recovery

### OpenSearch Backup

**Snapshot Repository**:
```bash
curl -X PUT "localhost:9200/_snapshot/backup" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/mnt/backups"
  }
}
'
```

**Create Snapshot**:
```bash
curl -X PUT "localhost:9200/_snapshot/backup/snapshot_1"
```

**Restore Snapshot**:
```bash
curl -X POST "localhost:9200/_snapshot/backup/snapshot_1/_restore"
```

### Database Backup

**Export Data**:
```bash
# Export index to JSON
curl -X GET "localhost:9200/fraud_detection/_search?scroll=1m" > backup.json
```

## Security

### Production Checklist

- [ ] Enable OpenSearch security plugin
- [ ] Use HTTPS/TLS for all connections
- [ ] Implement API authentication
- [ ] Set up rate limiting
- [ ] Configure firewall rules
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Network isolation (VPC)
- [ ] Input validation and sanitization

### OpenSearch Security

**Enable Security**:
```yaml
opensearch:
  environment:
    - DISABLE_SECURITY_PLUGIN=false
    - OPENSEARCH_INITIAL_ADMIN_PASSWORD=StrongPassword123!
```

**Configure TLS**:
```yaml
opensearch:
  volumes:
    - ./certs:/usr/share/opensearch/config/certs
  environment:
    - plugins.security.ssl.http.enabled=true
```

## Troubleshooting

### Common Issues

**1. OpenSearch Not Starting**
```bash
# Check logs
docker-compose logs opensearch

# Common fix: Increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144
```

**2. API Connection Timeout**
```bash
# Check network
docker-compose exec fraud-api ping opensearch

# Restart services
docker-compose restart
```

**3. Out of Memory**
```bash
# Increase OpenSearch heap
OPENSEARCH_JAVA_OPTS=-Xms2g -Xmx2g

# Increase Docker memory limit
docker-compose up -d --scale fraud-api=1
```

**4. Slow Queries**
```bash
# Check index stats
curl localhost:9200/fraud_detection/_stats

# Optimize index
curl -X POST localhost:9200/fraud_detection/_forcemerge
```

## Performance Tuning

### OpenSearch Optimization

**Index Settings**:
```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "30s"
  }
}
```

**Query Optimization**:
- Use filters instead of queries when possible
- Limit result size
- Use pagination
- Cache frequent queries

### API Optimization

**Async Processing**:
- Background tasks for CSV upload
- Async Alchemy API calls
- Connection pooling

**Caching**:
- Redis for frequent queries
- In-memory cache for features
- CDN for static content

## Cost Optimization

### AWS Deployment

**Estimated Costs** (us-east-1):
- EC2 t3.medium (API): $30/month
- OpenSearch t3.small: $40/month
- ALB: $20/month
- Data transfer: $10/month
- **Total**: ~$100/month

**Cost Reduction**:
- Use spot instances
- Reserved instances (1-year)
- S3 for backups (cheaper than EBS)
- CloudFront caching

## References
- #[[file:docker-compose.yml]]
- #[[file:Dockerfile]]
- #[[file:QUICKSTART.md]]
