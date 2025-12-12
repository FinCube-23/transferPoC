# Fraud Detection Integration

## Overview

The b2b-membership service now integrates with the fraud detection system to block transfers when users have high fraud scores. This document explains the architecture, configuration, and usage.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MongoDB Server                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │             b2b-membership Database                  │   │
│  │  - users                                             │   │
│  │  - organizations                                     │   │
│  │  - batches                                           │   │
│  │  - user_scores (fraud detection)                     │   │
│  │    * user_ref_number                                 │   │
│  │    * score (0.0 - 1.0)                               │   │
│  │    * last_result                                     │   │
│  │    * updated_at                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┴────────────────┐
           │                                 │
┌──────────▼──────────────┐      ┌──────────▼──────────────┐
│  b2b-membership         │      │  sc_fraud_detection     │
│  (Node.js/Express)      │      │  (Python/FastAPI)       │
│                         │      │                         │
│  - User management      │      │  - AI fraud detection   │
│  - Transfer service     │      │  - Score updates        │
│  - Fraud check service  │      │  - Analytics            │
│    (reads scores)       │      │    (writes scores)      │
└─────────────────────────┘      └─────────────────────────┘
```

### Key Components

1. **MongoDB Server**: Single database (`b2b-membership`) with all collections

    - `users`: User accounts and balances
    - `organizations`: Organization data
    - `batches`: Batch information
    - `user_scores`: Fraud detection scores (shared collection)

2. **b2b-membership Service** (this service):

    - **fraud-detection-service.js**: Accesses user_scores collection (read-only)
    - **transfer-controller.js**: Validates fraud scores before executing transfers
    - Blocks transfers if sender OR receiver has score >= 0.8

3. **sc_fraud_detection Service**:
    - Python/FastAPI service that analyzes transactions
    - Writes fraud scores to `user_scores` collection in the same database
    - Updates scores based on AI analysis

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Fraud Detection Configuration
# Specify the collection name (defaults to user_scores)
FRAUD_DETECTION_COLLECTION_NAME=user_scores
```

**Note**: No separate connection needed! The service accesses the `user_scores` collection directly from the same database using the existing mongoose connection.

### MongoDB Setup

The `user_scores` collection is automatically created by the sc_fraud_detection service in the same database. No manual setup is required in b2b-membership.

The `user_scores` collection schema:

```javascript
{
  user_ref_number: String,      // Indexed, unique
  score: Number,                 // 0.0 to 1.0
  last_confidence: Number,       // Last detection confidence
  last_result: String,           // "fraud" or "not_fraud"
  created_at: Date,
  updated_at: Date
}
```

## How It Works

### Transfer Workflow with Fraud Detection

```
1. Validate inputs
2. Retrieve user data (sender & receiver)
   ↓
3. CHECK FRAUD SCORES ← NEW STEP
   ↓
   • Query fraud_detection.user_scores for both users
   • Check if score >= 0.8 for either user
   • If blocked: Return 403 error
   • If clear: Continue transfer
   ↓
4. Generate ZKP proof (if cross-org transfer)
5. Execute blockchain transfer
6. Update database balances
7. Publish transaction receipt to RabbitMQ
```

### Fraud Score Threshold

-   **Threshold**: 0.8 (configurable in `fraud-detection-service.js`)
-   **Logic**: Transfer is blocked if **either** sender **or** receiver has score >= 0.8
-   **Default behavior**: If user has no score in database, transfer is allowed (score = 0.0)

### Error Handling

**When fraud score is too high:**

```json
{
    "success": false,
    "error": {
        "type": "FRAUD_SCORE_TOO_HIGH",
        "message": "Transfer blocked due to high fraud score",
        "details": {
            "blockedUsers": [
                {
                    "userRefNumber": "REF123456",
                    "score": 0.85,
                    "reason": "Fraud score (0.85) exceeds threshold (0.8)"
                }
            ],
            "threshold": 0.8,
            "explanation": "The following users have fraud scores that exceed the threshold: REF123456 (score: 0.85, reason: Fraud score (0.85) exceeds threshold (0.8))"
        }
    }
}
```

**When fraud detection service is unavailable:**

-   The transfer is **allowed** (fail-open behavior)
-   A warning is logged
-   You can change this to fail-closed by modifying `_checkFraudScores()` in transfer-controller.js

## API Changes

### POST /api/transfer

No changes to the API contract. The endpoint now includes fraud checking internally.

**Request** (unchanged):

```json
{
    "sender_user_id": 2001,
    "receiver_reference_number": "REF123456",
    "amount": 50
}
```

**Response - Success** (unchanged):

```json
{
  "success": true,
  "blockchain": { ... },
  "database": { ... }
}
```

**Response - Fraud Blocked** (new):

```json
{
  "success": false,
  "error": {
    "type": "FRAUD_SCORE_TOO_HIGH",
    "message": "Transfer blocked due to high fraud score",
    "details": { ... }
  }
}
```

## Testing

### Test Fraud Detection

1. **Set a high fraud score** using sc_fraud_detection service:

    ```python
    # In sc_fraud_detection service
    await mongodb_service.update_score("REF123456", 0.9, True)
    ```

2. **Attempt a transfer** from or to that user:

    ```bash
    curl -X POST http://localhost:8000/api/transfer \
      -H "Content-Type: application/json" \
      -d '{
        "sender_user_id": 2001,
        "receiver_reference_number": "REF123456",
        "amount": 50
      }'
    ```

3. **Expected result**: 403 Forbidden with fraud error

### Test Without Fraud Score

If a user has no fraud score in the database, the transfer proceeds normally (score defaults to 0.0).

## Logging

The fraud detection integration logs the following:

**When fraud check passes:**

```
[TransferController] [STEP 1.5/7] Checking fraud scores...
[FraudDetectionService] User fraud check passed { userRefNumber: 'REF123456', score: 0.5, threshold: 0.8 }
[TransferController] Fraud check passed { duration: '15ms', details: [...] }
```

**When fraud check fails:**

```
[TransferController] [STEP 1.5/7] Checking fraud scores...
[FraudDetectionService] User blocked due to high fraud score { userRefNumber: 'REF123456', score: 0.85, threshold: 0.8 }
[TransferController] Fraud check failed { duration: '15ms', type: 'FRAUD_SCORE_TOO_HIGH', ... }
```

## Maintenance

### Updating the Fraud Threshold

To change the threshold (default: 0.8):

1. Edit [services/fraud-detection-service.js](services/fraud-detection-service.js#L25)
2. Update `FRAUD_THRESHOLD` constant
3. Restart the service

### Monitoring

Monitor these metrics:

-   **Blocked transfers**: Check logs for `FRAUD_SCORE_TOO_HIGH` errors
-   **Fraud check duration**: Should be < 50ms
-   **MongoDB connection issues**: Check logs for connection errors

### Fail-Open vs Fail-Closed

**Current behavior (Fail-Open)**:

-   If fraud detection service is unavailable or errors occur, transfers are allowed
-   Rationale: Prevents legitimate transfers from being blocked by technical issues

**To change to Fail-Closed**:
Edit [controllers/transfer-controller.js](controllers/transfer-controller.js) in the `_checkFraudScores()` method:

```javascript
// Change this:
return {
    success: true, // Fail-open: allow transfer
    details: { warning: "..." },
}

// To this:
return {
    success: false, // Fail-closed: block transfer
    error: {
        type: "FRAUD_CHECK_ERROR",
        message: "Unable to verify fraud status",
        details: { error: error.message },
    },
}
```

## Dependencies

-   **mongoose**: Already installed - reuses the existing connection
-   No additional npm packages required

## Security Considerations

1. **Single Connection**: Uses the existing mongoose connection for efficiency
2. **Read-Only Access**: The fraud-detection-service only reads from the database
3. **Score Updates**: Only the sc_fraud_detection service should update scores
4. **Index**: The `user_ref_number` field is indexed for performance

## Troubleshooting

### "Cannot access user_scores collection"

-   Ensure mongoose is connected (check `MONGODB_URI` in your `.env`)
-   Verify `FRAUD_DETECTION_COLLECTION_NAME` matches the collection used by sc_fraud_detection (default: `user_scores`)

### Fraud check always passes even with high scores

-   Verify the database name and collection name match sc_fraud_detection
-   Check if scores are being written by sc_fraud_detection service
-   Review logs for connection issues

### Performance issues

-   Ensure `user_ref_number` index exists in `user_scores` collection
-   Monitor fraud check duration in logs (should be < 50ms)
-   Consider caching if needed (not currently implemented)

## Future Enhancements

Potential improvements:

1. **Caching**: Cache fraud scores for short periods (e.g., 1 minute)
2. **Webhooks**: Real-time notifications when scores are updated
3. **Audit trail**: Log all blocked transfers for compliance
4. **Configurable thresholds**: Different thresholds for different transaction amounts
5. **Gradual restrictions**: Warn users before blocking (e.g., at 0.6-0.7 score)
