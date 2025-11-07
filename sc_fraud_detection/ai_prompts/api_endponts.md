# Alchemy API Endpoints for Fraud Detection Service

## Dataset Features Analysis

Based on the Kaggle Ethereum Fraud Detection Dataset, we need to collect the following data points:

### Transaction Metrics
- Total sent/received transactions
- Transaction timing patterns
- Transaction values (min, max, avg)
- Contract creation transactions
- Unique addresses interacted with

### Balance & Value Metrics
- Total Ether sent/received
- Current balance
- Contract interaction values

### ERC20 Token Metrics
- ERC20 token transfers
- Token transaction patterns
- Unique token types

---

## Required Alchemy API Endpoints

### 1. **Core Transaction Data**

#### `alchemy_getAssetTransfers`
**Purpose**: Get all sent and received transactions for an address
**Endpoint**: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "alchemy_getAssetTransfers",
  "params": [
    {
      "fromBlock": "0x0",
      "toBlock": "latest",
      "fromAddress": "0xADDRESS",
      "category": ["external", "internal", "erc20", "erc721", "erc1155"],
      "withMetadata": true,
      "excludeZeroValue": false,
      "maxCount": "0x3e8"
    }
  ]
}
```

**Data Extracted**:
- Sent_tnx (count of fromAddress matches)
- Received_tnx (count of toAddress matches)
- Total_Ether_Sent
- Total_Ether_Received
- Min/Max/Avg values for sent/received
- Unique_Sent_To_Addresses
- Unique_Received_From_Addresses
- Time differences between transactions
- ERC20 transaction counts and values

---

### 2. **Current Balance**

#### `eth_getBalance`
**Purpose**: Get current Ether balance
**Endpoint**: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getBalance",
  "params": ["0xADDRESS", "latest"]
}
```

**Data Extracted**:
- Total_Ether_Balance

---

### 3. **Token Balances (ERC20)**

#### `alchemy_getTokenBalances`
**Purpose**: Get all ERC20 token balances
**Endpoint**: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "alchemy_getTokenBalances",
  "params": ["0xADDRESS", "erc20"]
}
```

**Data Extracted**:
- ERC20_Uniq_Sent_Token_Name
- ERC20_Uniq_Rec_Token_Name
- Current token holdings

---

### 4. **Token Metadata**

#### `alchemy_getTokenMetadata`
**Purpose**: Get details about specific tokens
**Endpoint**: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "alchemy_getTokenMetadata",
  "params": ["0xTOKEN_CONTRACT_ADDRESS"]
}
```

**Data Extracted**:
- ERC20_Most_Sent_Token_Type
- ERC20_Most_Rec_Token_Type
- Token names and symbols

---

### 5. **Transaction Count**

#### `eth_getTransactionCount`
**Purpose**: Get total number of transactions sent from address
**Endpoint**: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getTransactionCount",
  "params": ["0xADDRESS", "latest"]
}
```

**Data Extracted**:
- Nonce (total outgoing transactions)
- Validation for Sent_tnx

---

### 6. **Contract Creation Detection**

#### `eth_getCode`
**Purpose**: Check if address is a contract
**Endpoint**: `https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getCode",
  "params": ["0xADDRESS", "latest"]
}
```

**Data Extracted**:
- Number_of_Created_Contracts (by analyzing transaction receipts)
- Contract interaction patterns

---

## Data Processing Pipeline

### Step 1: Fetch Raw Data
```python
# Pseudo-code structure
async def fetch_account_data(address: str):
    # 1. Get all asset transfers (sent)
    sent_transfers = alchemy_getAssetTransfers(fromAddress=address)
    
    # 2. Get all asset transfers (received)
    received_transfers = alchemy_getAssetTransfers(toAddress=address)
    
    # 3. Get current balance
    balance = eth_getBalance(address)
    
    # 4. Get token balances
    token_balances = alchemy_getTokenBalances(address)
    
    # 5. Get transaction count
    tx_count = eth_getTransactionCount(address)
    
    return {
        "sent": sent_transfers,
        "received": received_transfers,
        "balance": balance,
        "tokens": token_balances,
        "tx_count": tx_count
    }
```

### Step 2: Calculate Features
```python
def calculate_features(raw_data):
    features = {}
    
    # Transaction counts
    features["Sent_tnx"] = len([t for t in raw_data["sent"] if t["category"] == "external"])
    features["Received_tnx"] = len([t for t in raw_data["received"] if t["category"] == "external"])
    
    # Timing analysis
    sent_timestamps = [t["metadata"]["blockTimestamp"] for t in raw_data["sent"]]
    features["Avg_min_between_sent_tnx"] = calculate_avg_time_diff(sent_timestamps)
    
    # Value analysis
    sent_values = [float(t["value"]) for t in raw_data["sent"]]
    features["Min_Val_Sent"] = min(sent_values) if sent_values else 0
    features["Max_Val_Sent"] = max(sent_values) if sent_values else 0
    features["Avg_Val_Sent"] = sum(sent_values) / len(sent_values) if sent_values else 0
    
    # Unique addresses
    features["Unique_Sent_To_Addresses"] = len(set([t["to"] for t in raw_data["sent"]]))
    features["Unique_Received_From_Addresses"] = len(set([t["from"] for t in raw_data["received"]]))
    
    # ERC20 analysis
    erc20_sent = [t for t in raw_data["sent"] if t["category"] == "erc20"]
    erc20_received = [t for t in raw_data["received"] if t["category"] == "erc20"]
    
    features["Total_ERC20_Tnxs"] = len(erc20_sent) + len(erc20_received)
    features["ERC20_Uniq_Sent_Token_Name"] = len(set([t["rawContract"]["address"] for t in erc20_sent]))
    features["ERC20_Uniq_Rec_Token_Name"] = len(set([t["rawContract"]["address"] for t in erc20_received]))
    
    # Contract interactions
    contract_txs = [t for t in raw_data["sent"] if t.get("to") and is_contract(t["to"])]
    features["Total_Ether_Sent_Contracts"] = sum([float(t["value"]) for t in contract_txs])
    
    # Balance
    features["Total_Ether_Balance"] = float(raw_data["balance"])
    
    return features
```

### Step 3: Vector Embedding for K-NN
```python
def create_feature_vector(features):
    # Normalize and create vector for K-NN comparison
    vector = [
        features["Sent_tnx"],
        features["Received_tnx"],
        features["Avg_min_between_sent_tnx"],
        features["Total_Ether_Sent"],
        features["Total_Ether_Received"],
        features["Total_Ether_Balance"],
        features["Unique_Sent_To_Addresses"],
        features["Unique_Received_From_Addresses"],
        features["Total_ERC20_Tnxs"],
        # ... all other features
    ]
    return normalize_vector(vector)
```

---

## API Rate Limits & Optimization

### Alchemy Free Tier
- 300 compute units per second
- 300M compute units per month

### Optimization Strategies
1. **Batch requests**: Use `alchemy_getAssetTransfers` with pagination
2. **Cache results**: Store processed data to avoid repeated API calls
3. **Use webhooks**: For real-time monitoring (optional)
4. **Parallel requests**: Fetch sent/received transfers simultaneously

### Compute Unit Costs
- `alchemy_getAssetTransfers`: 150 CU per request
- `eth_getBalance`: 19 CU
- `alchemy_getTokenBalances`: 46 CU
- `eth_getTransactionCount`: 19 CU

**Total per address check**: ~234 CU (within free tier limits)

---

## Implementation Notes

### Key Considerations
1. **Historical data**: `alchemy_getAssetTransfers` can fetch from block 0, but may require pagination for active addresses
2. **Contract detection**: Need to check transaction receipts to identify contract creation
3. **Time calculations**: Convert block timestamps to minutes for timing features
4. **ERC20 token identification**: Use token metadata to get most sent/received token types
5. **Data normalization**: Ensure all values match the dataset's format (Ether units, time in minutes)

### Missing Data Handling
Some features may require additional computation:
- **Number_of_Created_Contracts**: Analyze transaction receipts for contract creation
- **Time_Diff_between_first_and_last**: Calculate from first and last transaction timestamps
- **Most sent/received tokens**: Aggregate and rank token transfers

---

## Next Steps

1. Set up Alchemy API key
2. Implement data fetching functions
3. Build feature extraction pipeline
4. Load Kaggle dataset into OpenSearch
5. Implement K-NN similarity search
6. Integrate Gemini for pattern analysis
7. Build FastAPI endpoints
