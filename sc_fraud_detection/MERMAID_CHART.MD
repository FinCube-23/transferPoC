# Architecture Diagrams (Mermaid)

## System Overview

```mermaid
graph TB
    Client[Client]
    API[FastAPI API]
    OpenSearch[(OpenSearch Vector DB<br/>K-NN)]
    Kaggle[External Sources<br/>Kaggle/CSV/JSON]
    Alchemy[Alchemy API<br/>Ethereum Data]
    RAG[RAG Service<br/>Gemini AI]
    KNN[K-NN Service<br/>Analysis]
    
    Client --> API
    Kaggle --> API
    API --> OpenSearch
    API --> Alchemy
    API --> RAG
    API --> KNN
    
    style API fill:#4CAF50
    style OpenSearch fill:#2196F3
    style RAG fill:#FF9800
    style KNN fill:#9C27B0
```

## Data Loading Flow

```mermaid
sequenceDiagram
    participant User
    participant API as POST /data/scrape
    participant Scraper as DataScraper
    participant Extractor as FeatureExtractor
    participant OS as OpenSearch
    
    User->>API: POST with source_url
    API->>Scraper: Start scraping
    Scraper->>Scraper: Download from Kaggle/CSV/JSON
    Scraper->>Scraper: Parse and clean data
    Scraper-->>API: Return records
    
    loop For each record
        API->>Extractor: Extract features
        Extractor->>Extractor: Convert to 44-dim vector
        Extractor-->>API: Feature vector
    end
    
    API->>OS: Bulk insert vectors
    OS-->>API: Insert confirmation
    API-->>User: Success response
```

## Fraud Detection Flow

```mermaid
sequenceDiagram
    participant User
    participant API as POST /fraud/score
    participant Alchemy as AlchemyService
    participant FE as FeatureExtractor
    participant OS as OpenSearch
    participant KNN as KNNService
    participant RAG as RAGService
    
    User->>API: POST with address
    
    API->>Alchemy: Fetch account data
    Alchemy->>Alchemy: Get sent/received txns
    Alchemy->>Alchemy: Get balance & tokens
    Alchemy-->>API: Account data
    
    API->>FE: Extract features
    FE->>FE: Calculate 44 metrics
    FE-->>API: Feature vector
    
    API->>OS: K-NN search (k=10)
    OS->>OS: HNSW similarity search
    OS-->>API: 10 nearest neighbors
    
    API->>KNN: Analyze neighbors
    KNN->>KNN: Weighted probability
    KNN->>KNN: Confidence calculation
    KNN-->>API: KNN analysis
    
    API->>RAG: Final analysis
    RAG->>RAG: Node 1: Analyze patterns
    RAG->>RAG: Node 2: Detect edge cases
    RAG->>RAG: Node 3: Final decision
    RAG-->>API: Decision + reasoning
    
    API-->>User: Fraud score response
```

## RAG Service Workflow (LangGraph)

```mermaid
graph TD
    Start([Input: KNN Results + Features])
    
    Node1[Node 1: Analyze K-NN<br/>Gemini analyzes patterns]
    Node2[Node 2: Detect Edge Cases<br/>Rule-based checks]
    Node3[Node 3: Final Decision<br/>Gemini makes call]
    
    End([Output: JSON Decision])
    
    Start --> Node1
    Node1 --> |Analysis text| Node2
    Node2 --> |Edge cases list| Node3
    Node3 --> End
    
    EdgeCases[Edge Case Detection:<br/>- High volume + low balance<br/>- Imbalanced tx ratio<br/>- Large value movements<br/>- Rapid activity<br/>- Low KNN confidence<br/>- Heavy ERC20 usage]
    
    Node2 -.-> EdgeCases
    
    style Node1 fill:#FF9800
    style Node2 fill:#2196F3
    style Node3 fill:#4CAF50
    style EdgeCases fill:#FFC107
```

## Component Architecture

```mermaid
graph TB
    subgraph "API Layer"
        Health[routes/health.py]
        Data[routes/data.py]
        Fraud[routes/fraud.py]
        Deps[deps.py]
    end
    
    subgraph "Service Layer"
        Alchemy[alchemy_service.py<br/>Blockchain Data]
        OpenSearch[opensearch_service.py<br/>Vector DB]
        KNN[knn_service.py<br/>Analysis]
        RAG[rag_service.py<br/>AI Decision]
    end
    
    subgraph "Data Layer"
        Scraper[data_scraper.py<br/>Multi-source]
        Extractor[feature_extractor.py<br/>44 Features]
    end
    
    subgraph "External"
        AlchemyAPI[Alchemy API]
        GeminiAPI[Gemini API]
        KaggleAPI[Kaggle API]
        OSDB[(OpenSearch DB)]
    end
    
    Fraud --> Deps
    Data --> Deps
    Deps --> Alchemy
    Deps --> OpenSearch
    Deps --> KNN
    Deps --> RAG
    
    Data --> Scraper
    Fraud --> Extractor
    Data --> Extractor
    
    Alchemy --> AlchemyAPI
    RAG --> GeminiAPI
    Scraper --> KaggleAPI
    OpenSearch --> OSDB
    
    style Fraud fill:#4CAF50
    style Data fill:#2196F3
    style RAG fill:#FF9800
    style KNN fill:#9C27B0
```

## K-NN Service Algorithm Flow

```mermaid
flowchart TD
    Start([10 Nearest Neighbors])
    
    Extract[Extract distances & flags]
    Weights[Calculate inverse distance weights<br/>weight = 1 / distance + ε]
    
    WeightedProb[Weighted Fraud Probability<br/>Σ weight × flag / Σ weight]
    SimpleProb[Simple Probability<br/>fraud_count / total_count]
    
    DistConf[Distance Confidence<br/>1 / 1 + avg_distance]
    Agreement[Agreement Score<br/>max fraud, non-fraud / total]
    
    FinalConf[Final Confidence<br/>distance_conf + agreement / 2]
    
    Decision{Confidence < 0.4?}
    ProbCheck{Fraud Prob >= 0.5?}
    
    Undecided([Undecided])
    Fraud([Fraud])
    NotFraud([Not Fraud])
    
    Start --> Extract
    Extract --> Weights
    Weights --> WeightedProb
    Weights --> SimpleProb
    
    Extract --> DistConf
    Extract --> Agreement
    
    DistConf --> FinalConf
    Agreement --> FinalConf
    
    WeightedProb --> Decision
    FinalConf --> Decision
    
    Decision -->|Yes| Undecided
    Decision -->|No| ProbCheck
    
    ProbCheck -->|Yes| Fraud
    ProbCheck -->|No| NotFraud
    
    style WeightedProb fill:#4CAF50
    style FinalConf fill:#2196F3
    style Fraud fill:#f44336
    style NotFraud fill:#8BC34A
    style Undecided fill:#FFC107
```

## Feature Extraction Pipeline

```mermaid
flowchart LR
    subgraph Input
        RawData[Raw Account Data<br/>from Alchemy]
    end
    
    subgraph Processing
        TxMetrics[Transaction Metrics<br/>sent, received, total]
        Timing[Timing Metrics<br/>avg time, time range]
        Values[Value Metrics<br/>min, max, avg, total]
        Addresses[Address Metrics<br/>unique sent/received]
        Contracts[Contract Metrics<br/>counts, values]
        ERC20[ERC20 Metrics<br/>22 features]
    end
    
    subgraph Output
        Vector[44-Dimensional<br/>Feature Vector]
    end
    
    RawData --> TxMetrics
    RawData --> Timing
    RawData --> Values
    RawData --> Addresses
    RawData --> Contracts
    RawData --> ERC20
    
    TxMetrics --> Vector
    Timing --> Vector
    Values --> Vector
    Addresses --> Vector
    Contracts --> Vector
    ERC20 --> Vector
    
    style Vector fill:#4CAF50
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Docker Compose"
        subgraph "API Container"
            FastAPI[FastAPI App<br/>Port 8000]
            Workers[Uvicorn Workers]
        end
        
        subgraph "OpenSearch Container"
            OS[OpenSearch<br/>Port 9200]
            HNSW[HNSW Index<br/>Vector Search]
        end
    end
    
    subgraph "External APIs"
        Alchemy[Alchemy API<br/>Ethereum Data]
        Gemini[Google Gemini<br/>LLM Analysis]
        Kaggle[Kaggle API<br/>Training Data]
    end
    
    Users[Users/Clients] --> FastAPI
    FastAPI --> OS
    FastAPI --> Alchemy
    FastAPI --> Gemini
    FastAPI --> Kaggle
    
    OS --> HNSW
    
    style FastAPI fill:#4CAF50
    style OS fill:#2196F3
    style HNSW fill:#9C27B0
```

## Data Flow Summary

```mermaid
graph LR
    A[User Address] --> B[Alchemy API]
    B --> C[Raw Account Data]
    C --> D[Feature Extractor]
    D --> E[44-D Vector]
    E --> F[OpenSearch K-NN]
    F --> G[10 Nearest Neighbors]
    G --> H[KNN Service]
    H --> I[Fraud Probability]
    I --> J[RAG Service]
    J --> K[Final Decision]
    
    style E fill:#4CAF50
    style G fill:#2196F3
    style I fill:#9C27B0
    style K fill:#FF9800
```
