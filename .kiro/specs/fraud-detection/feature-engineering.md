---
title: Feature Engineering System
status: implemented
created: 2024-11-19
---

# Feature Engineering System

## Overview
Extracts 47 numerical features from Ethereum address transaction data for fraud detection using KNN and machine learning models.

## Feature Categories

### 1. Basic Transaction Features (7 features)

| Feature | Description | Calculation |
|---------|-------------|-------------|
| `Sent tnx` | Total sent transactions | `len(sent_transactions)` |
| `Received Tnx` | Total received transactions | `len(received_transactions)` |
| `Number of Created Contracts` | Contracts created | Count of contract creation txs |
| `Unique Received From Addresses` | Unique senders | `len(set(tx['from']))` |
| `Unique Sent To Addresses` | Unique recipients | `len(set(tx['to']))` |
| `total transactions` | All transactions | `sent + received + contracts` |
| `Time Diff between first and last` | Account age (minutes) | `(last_tx - first_tx) / 60` |

### 2. Temporal Features (2 features)

| Feature | Description | Formula |
|---------|-------------|---------|
| `Avg min between sent tnx` | Average time between sent txs | `total_time_diff / (n_txs - 1)` |
| `Avg min between received tnx` | Average time between received txs | `total_time_diff / (n_txs - 1)` |

**Edge Cases**:
- Single transaction: return 0
- No transactions: return 0

### 3. ETH Value Features (9 features)

| Feature | Description | Unit |
|---------|-------------|------|
| `min value received` | Minimum ETH received | Wei → ETH |
| `max value received` | Maximum ETH received | Wei → ETH |
| `avg val received` | Average ETH received | Wei → ETH |
| `min val sent` | Minimum ETH sent | Wei → ETH |
| `max val sent` | Maximum ETH sent | Wei → ETH |
| `avg val sent` | Average ETH sent | Wei → ETH |
| `total Ether sent` | Total ETH sent | Wei → ETH |
| `total ether received` | Total ETH received | Wei → ETH |
| `total ether balance` | Current balance | Wei → ETH |

**Conversion**: `1 ETH = 10^18 Wei`

### 4. Contract Interaction Features (3 features)

| Feature | Description | Filter |
|---------|-------------|--------|
| `min value sent to contract` | Min value to contracts | `tx['to'] is contract` |
| `max val sent to contract` | Max value to contracts | `tx['to'] is contract` |
| `avg value sent to contract` | Avg value to contracts | `tx['to'] is contract` |

**Contract Detection**: Check if `to` address has bytecode

### 5. ERC20 Token Features (26 features)

#### Basic Token Stats (6 features)
- `Total ERC20 tnxs`: Total token transactions
- `ERC20 total Ether received`: Total value received
- `ERC20 total ether sent`: Total value sent
- `ERC20 total Ether sent contract`: Value sent to contracts
- `ERC20 uniq sent addr`: Unique token recipients
- `ERC20 uniq rec addr`: Unique token senders

#### Token Address Features (2 features)
- `ERC20 uniq sent addr.1`: Duplicate of unique sent
- `ERC20 uniq rec contract addr`: Unique contract recipients

#### Token Temporal Features (4 features)
- `ERC20 avg time between sent tnx`: Avg time between sends
- `ERC20 avg time between rec tnx`: Avg time between receives
- `ERC20 avg time between rec 2 tnx`: Alternative receive timing
- `ERC20 avg time between contract tnx`: Contract interaction timing

#### Token Value Features (9 features)
- `ERC20 min val rec`: Minimum token value received
- `ERC20 max val rec`: Maximum token value received
- `ERC20 avg val rec`: Average token value received
- `ERC20 min val sent`: Minimum token value sent
- `ERC20 max val sent`: Maximum token value sent
- `ERC20 avg val sent`: Average token value sent
- `ERC20 min val sent contract`: Min value to contracts
- `ERC20 max val sent contract`: Max value to contracts
- `ERC20 avg val sent contract`: Avg value to contracts

#### Token Diversity Features (5 features)
- `ERC20 uniq sent token name`: Unique tokens sent
- `ERC20 uniq rec token name`: Unique tokens received
- `ERC20 most sent token type`: Most frequently sent token
- `ERC20_most_rec_token_type`: Most frequently received token
- Token concentration ratio (derived)

## Feature Extraction Pipeline

### Step 1: Data Collection
```python
account_data = {
    'address': str,
    'balance': str (wei),
    'transaction_count': int,
    'sent_transactions': List[Dict],
    'received_transactions': List[Dict]
}
```

### Step 2: Feature Calculation
```python
features = FeatureExtractor.extract_features(account_data)
# Returns: Dict[str, float] with 47 features
```

### Step 3: Vectorization
```python
vector = FeatureExtractor.features_to_vector(features)
# Returns: List[float] of length 47
```

### Step 4: Normalization
```python
normalized = FeatureExtractor.normalize_vector(vector)
# Returns: Scaled vector using StandardScaler
```

## Normalization Strategy

### StandardScaler
- **Method**: Z-score normalization
- **Formula**: `(x - mean) / std_dev`
- **Persistence**: Scaler saved to `scaler.pkl`

### Training Process
```python
# Fit scaler on training data
feature_vectors = [extract_features(addr) for addr in training_set]
FeatureExtractor.fit_scaler(feature_vectors)

# Save for inference
scaler.save('scaler.pkl')
```

### Inference Process
```python
# Load pre-trained scaler
FeatureExtractor.load_scaler()

# Normalize new vector
normalized = FeatureExtractor.normalize_vector(new_vector)
```

## Data Quality Handling

### Missing Data
- **Strategy**: Fill with 0.0
- **Rationale**: Absence of activity is meaningful signal

### Outliers
- **Detection**: Values > 3 standard deviations
- **Handling**: Clipped to 3σ during normalization

### Invalid Values
- **NaN/Inf**: Replaced with 0.0
- **Negative values**: Validated per feature (some allow negative)

## Feature Importance

### High-Impact Features (Top 10)
1. `total transactions` - Overall activity level
2. `Unique Sent To Addresses` - Network diversity
3. `total ether balance` - Financial capacity
4. `ERC20 total Ether sent` - Token activity
5. `avg val sent` - Transaction patterns
6. `Number of Created Contracts` - Developer activity
7. `Time Diff between first and last` - Account age
8. `ERC20 uniq sent token name` - Token diversity
9. `Avg min between sent tnx` - Frequency patterns
10. `total Ether sent` - Volume

### Low-Impact Features
- Individual min/max values (high variance)
- Duplicate features (e.g., `ERC20 uniq sent addr.1`)

## Performance Optimization

### Caching
- Cache Alchemy API responses
- Cache feature calculations for repeated addresses

### Batch Processing
- Process multiple addresses in parallel
- Vectorize calculations using NumPy

### Lazy Loading
- Load scaler only when needed
- Defer expensive calculations

## Validation

### Feature Range Checks
```python
assert features['Sent tnx'] >= 0
assert features['total ether balance'] >= 0
assert 0 <= features['Avg min between sent tnx']
```

### Consistency Checks
```python
assert features['total transactions'] >= features['Sent tnx']
assert features['total transactions'] >= features['Received Tnx']
```

## Testing

### Unit Tests
- Test each feature calculation independently
- Test edge cases (0 transactions, single transaction)
- Test data type conversions

### Integration Tests
- Test full pipeline with real addresses
- Validate against known fraud/legitimate addresses
- Check normalization consistency

## Future Enhancements

### Additional Features
- Gas price patterns
- Failed transaction ratio
- Internal transaction analysis
- NFT activity metrics

### Feature Selection
- Correlation analysis
- Recursive feature elimination
- SHAP value analysis

### Dynamic Features
- Time-windowed features (last 30 days)
- Trend features (increasing/decreasing activity)
- Comparative features (vs. network average)

## References
- #[[file:app/utils/feature_extractor.py]]
- #[[file:ARCHITECTURE.md]]
