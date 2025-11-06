# Project Structure

```
fraud-detection-service/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app
│   ├── config.py                  # Configuration
│   ├── models.py                  # Pydantic models
│   ├── scraper/
│   │   ├── __init__.py
│   │   └── data_scraper.py        # Generic scraper
│   ├── services/
│   │   ├── __init__.py
│   │   ├── alchemy_service.py     # Alchemy API client
│   │   ├── opensearch_service.py  # Vector DB operations
│   │   ├── knn_service.py         # K-NN comparison
│   │   └── rag_service.py         # LangChain/LangGraph RAG
│   └── utils/
│       ├── __init__.py
│       └── feature_extractor.py   # Feature calculation
└── scripts/
    └── init_db.py                 # DB initialization
```
