# Project Structure
```
sc_fraud_detection/
├── README.md
├── ARCHITECTURE.md
├── QUICKSTART.md
├── USAGE_EXAMPLES.md
├── project_structure.md
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── test_api.sh
├── .gitignore
├── ai_prompts/
│ ├── api_endponts.md
│ ├── prompt_one.md
│ └── service_overview.md
└── app/
├── init.py
├── main.py
├── config.py
├── models.py
├── api/
│ ├── init.py
│ ├── deps.py
│ └── routes/
│   ├── init.py
│   ├── health.py
│   ├── data.py
│   └── fraud.py
├── services/
│ ├── init.py
│ ├── alchemy_service.py
│ ├── opensearch_service.py
│ ├── knn_service.py
│ └── rag_service.py
├── scraper/
│ ├── init.py
│ └── data_scraper.py
└── utils/
├── init.py
└── feature_extractor.py
```