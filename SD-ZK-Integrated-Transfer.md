```mermaid
sequenceDiagram
    participant User1 as User 1
    participant OrgA as Organization A
    participant DAO as DAO Contract
    participant OrgB as Organization B
    participant User2 as User 2
    participant Blockchain as Blockchain (Event Log)
    User1->>OrgA: Register (email, user details)
    OrgA->>DAO: Request reference number (email_hash, org_reference_key)
    DAO->>DAO: Compute reference_number = keccak256(email_hash, org_reference_key, salt)
    DAO-->>OrgA: Return reference_number
    DAO-->>Blockchain: Emit ReferenceNumberIssued(org_id, reference_number)
    OrgA->>OrgA: Store reference_number and assign to User1
    User2->>OrgB: Register (email, user details)
    OrgB->>DAO: Request reference number (email_hash, org_reference_key)
    DAO->>DAO: Compute reference_number = keccak256(email_hash, org_reference_key, salt)
    DAO-->>OrgB: Return reference_number
    DAO-->>Blockchain: Emit ReferenceNumberIssued(org_id, reference_number)
    OrgB->>OrgB: Store reference_number and assign to User2
    User1->>OrgA: Send(receiver_reference_number, amount)
    OrgA->>OrgA: Lookup receiver org (OrgB) using DAO event index
    OrgA->>OrgB: Send(receiver_reference_number, ZK proof u1 ∈ OrgA)
    OrgB->>OrgB: Verify ZK proof
    OrgB->>User2: Lookup user by receiver_reference_number
    OrgB->>OrgA: Return ZK proof u2 ∈ OrgB
    OrgA->>OrgA: Verify proof
    OrgA->>OrgB: Transfer stablecoin (ERC20)
    OrgA->>User1: Update balance (debit)
    OrgB->>User2: Update balance (credit)
    OrgB->>Blockchain: Emit TransactionRecorded(sender_reference, receiver_reference, amount, invoice)
```

## SC Fraud Detection Service Diagram.
```
sequenceDiagram
    participant User as User/Client
    participant API as FastAPI API
    participant Alchemy as Alchemy API
    participant FE as Feature Extractor
    participant OS as OpenSearch (Vector DB)
    participant KNN as K-NN Service
    participant RAG as RAG Service (Gemini)
    participant BC as Blockchain (Ethereum)
    
    User->>API: POST /score (address)
    API->>Alchemy: Request transaction history
    Alchemy->>BC: Query sent transactions
    BC-->>Alchemy: Return sent transactions
    Alchemy->>BC: Query received transactions
    BC-->>Alchemy: Return received transactions
    Alchemy->>BC: Query balance & token data
    BC-->>Alchemy: Return balance & tokens
    Alchemy-->>API: Return complete account data
    
    API->>FE: Extract features from raw data
    FE->>FE: Calculate 44-dimensional vector<br/>(tx metrics, timing, values, ERC20)
    FE-->>API: Return normalized feature vector
    
    API->>OS: K-NN search (vector, k=10)
    OS->>OS: HNSW similarity search<br/>(L2 distance)
    OS-->>API: Return 10 nearest neighbors
    
    API->>KNN: Analyze neighbors
    KNN->>KNN: Calculate weighted fraud probability<br/>Calculate confidence score
    KNN-->>API: Return K-NN analysis
    
    API->>RAG: Request RAG analysis
    RAG->>RAG: Node 1: Analyze K-NN results (Gemini)
    RAG->>RAG: Node 2: Detect edge cases<br/>(volume/balance, timing, ERC20)
    RAG->>RAG: Node 3: Final decision (Gemini)
    RAG-->>API: Return final decision + reasoning
    
    API->>API: Combine K-NN + RAG results<br/>Determine final classification
    API-->>User: Return JSON response<br/>(result, probability, confidence, reasoning)
```