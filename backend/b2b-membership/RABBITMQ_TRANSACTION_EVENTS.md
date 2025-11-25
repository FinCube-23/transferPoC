# RabbitMQ Transaction Receipt Events

## Overview

After a successful blockchain transfer, the system automatically publishes a transaction receipt event to RabbitMQ. This allows other services (like the Audit Trail service) to consume and process transaction data for logging, monitoring, and auditing purposes.

## Event Flow

```
Transfer Controller
    ↓
Transfer Service → Blockchain Transaction (FinCube Contract)
    ↓
Transaction Confirmed
    ↓
Transfer Controller → Publish to RabbitMQ (exchange.transaction-receipt.fanout)
    ↓
Audit Trail Service (Consumer)
    ↓
Store in Database
```

## Workflow Steps

The transfer workflow executes these steps in order:

1. **Validate Inputs** - Validate request parameters
2. **Retrieve User Data** - Fetch sender, receiver, and organization data
3. **Generate ZKP Proof** - Generate zero-knowledge proof for receiver (cross-org only)
4. **Generate Nullifier** - Create unique nullifier for the transaction
5. **Create Memo** - Build transaction memo with metadata
6. **Execute Blockchain Transfer** - Submit transaction to FinCube contract
7. **Publish Transaction Receipt** - Emit event to RabbitMQ (Step 6/7)
8. **Update Database Balances** - Update sender and receiver balances (Step 7/7)

## Exchange Configuration

- **Exchange Name**: Configurable via `RABBITMQ_TRANSACTION_RECEIPT_EXCHANGE` (default: `exchange.transaction-receipt.fanout`)
- **Exchange Type**: `fanout`
- **Durable**: `true`
- **Routing Key**: `` (empty - fanout exchanges ignore routing keys)

## Event Structure

### TransactionReceiptEventDto

```typescript
{
  onChainData: {
    transactionHash: string;      // Transaction hash (0x...)
    signedBy: string;              // Wallet address that signed the transaction
    chainId: string;               // Chain ID (e.g., "44787" for Celo Alfajores)
    context: {
      fromUserId: number;          // Sender user ID
      toUserId: number;            // Receiver user ID
      amount: number;              // Transfer amount
      senderWalletAddress: string; // Sender's wallet address
      receiverWalletAddress: string; // Receiver's wallet address
      blockNumber: number;         // Block number
      gasUsed: string;             // Gas used
      memo: string;                // Transfer memo (JSON string)
      nullifier: string;           // Nullifier (0x...)
    };
  };
  timestamp: string;               // ISO 8601 timestamp
}
```

### Example Event

```json
{
  "onChainData": {
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "signedBy": "0x9F5C51C2e4581802d6E5809f4a8C0C5f5809f123",
    "chainId": "44787",
    "context": {
      "fromUserId": 2001,
      "toUserId": 2002,
      "amount": 50,
      "senderWalletAddress": "0x1111111111111111111111111111111111111111",
      "receiverWalletAddress": "0x2222222222222222222222222222222222222222",
      "blockNumber": 12345678,
      "gasUsed": "150000",
      "memo": "{\"sender_reference_number\":\"REF-001\",\"receiver_reference_number\":\"REF-002\",\"amount\":50,\"timestamp\":\"2024-01-01T00:00:00.000Z\"}",
      "nullifier": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Publisher Implementation

### Location
- **File**: `backend/b2b-membership/utils/rabbitmq-publisher.js`
- **Function**: `publishTransactionReceipt(transactionData)`

### Usage in Transfer Controller

The publishing happens in the transfer controller as **Step 6/7** after a successful blockchain transaction:

```javascript
const { publishTransactionReceipt } = require("../utils/rabbitmq-publisher")

// Step 7: Publish transaction receipt to RabbitMQ
this.logger.info("[STEP 6/7] Publishing transaction receipt to RabbitMQ...")

try {
    // Get chain ID from blockchain result or use configured value
    const chainId = blockchainResult.transaction.chainId || 
                    process.env.CHAIN_ID || 
                    "unknown"
    
    await publishTransactionReceipt({
        transactionHash: blockchainResult.transaction.transactionHash,
        signedBy: blockchainResult.transaction.senderWalletAddress,
        chainId: chainId.toString(),
        context: {
            fromUserId: sender.user_id,
            toUserId: receiver.user_id,
            amount,
            senderWalletAddress: blockchainResult.transaction.senderWalletAddress,
            receiverWalletAddress: blockchainResult.transaction.receiverWalletAddress,
            blockNumber: blockchainResult.transaction.blockNumber,
            gasUsed: blockchainResult.transaction.gasUsed,
            memo,
            nullifier,
        },
    })
    
    this.logger.info("Transaction receipt published successfully")
} catch (publishError) {
    // Log error but don't fail the transaction
    this.logger.warn("Failed to publish transaction receipt to RabbitMQ", {
        error: publishError.message,
    })
}
```

## Consumer Implementation (Audit Trail Service)

### NestJS Example

```typescript
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@RabbitSubscribe({
  exchange: 'exchange.transaction-receipt.fanout',
  routingKey: '',
  queue: 'audit-trail-transaction-receipt-queue',
  queueOptions: {
    durable: true,
  },
})
async handleTransactionReceipt(event: TransactionReceiptEventDto) {
  this.logger.log('Got a new transaction hash ' + event.onChainData?.transactionHash);
  
  try {
    const new_dao_audit = {
      trx_hash: event.onChainData?.transactionHash,
      trx_sender: event.onChainData?.signedBy,
      chain_id: event.onChainData?.chainId,
      trx_status: 0,
      raw_trx: JSON.stringify(event.onChainData?.context),
    };
    
    const dbRecordedTRX = this.transactionRepository.create(new_dao_audit);
    const savedTransaction = await this.transactionRepository.save(dbRecordedTRX);
    
    this.logger.log(`Recorded transaction ID: ${savedTransaction.id} in DB`);
    this.logger.log('✅ Transaction receipt processing complete');
  } catch (error) {
    this.logger.error(
      `Transaction couldn't be logged in DB where transaction hash is ${event.onChainData?.transactionHash}. Error: ${error.message}`,
      error.stack,
    );
    throw new Error("Transaction couldn't be logged in Web2 DB.");
  }
}
```

## Testing

### Test Publisher

```bash
cd backend/b2b-membership
node test-rabbitmq-publisher.js
```

This will:
1. Initialize the publisher
2. Publish test transaction receipts
3. Verify the connection
4. Clean up resources

### Manual Testing with RabbitMQ Management UI

1. Access RabbitMQ Management UI: `http://localhost:15672`
2. Login with credentials (default: guest/guest)
3. Navigate to **Exchanges** → `exchange.transaction-receipt.fanout`
4. Check **Bindings** to see connected queues
5. Navigate to **Queues** → `audit-trail-transaction-receipt-queue`
6. View messages in the queue

## Error Handling

The publisher is designed to be non-blocking:
- If publishing fails, the error is logged but the transaction is still considered successful
- The blockchain transaction is not rolled back if RabbitMQ publishing fails
- This ensures that RabbitMQ issues don't affect the core transfer functionality

```javascript
try {
    await publishTransactionReceipt(transactionData)
    console.log(`Transaction receipt event published for hash: ${receipt.hash}`)
} catch (publishError) {
    // Log error but don't fail the transaction
    console.error("Failed to publish transaction receipt to RabbitMQ:", publishError.message)
}
```

## Health Check

The health check endpoint includes publisher status:

```bash
curl http://localhost:7000/health
```

Response:
```json
{
  "status": "ok",
  "service": "zkp-proof-controller",
  "database": "connected",
  "rabbitmq": {
    "consumer": "connected",
    "publisher": "connected"
  }
}
```

## Configuration

### Environment Variables

See `.env.example` for RabbitMQ configuration:

```env
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_TRANSACTION_RECEIPT_EXCHANGE=exchange.transaction-receipt.fanout

# Chain ID (used as fallback if not retrieved from blockchain)
# Ethereum Sepolia: 11155111, Celo Alfajores: 44787, Celo Mainnet: 42220
CHAIN_ID=44787
```

### Initialization

The publisher is automatically initialized when the server starts:

```javascript
// In index.js
initializePublisher().catch((error) => {
    console.error("Failed to initialize RabbitMQ publisher:", error)
    console.log("Server will continue running without RabbitMQ publisher")
})
```

### Graceful Shutdown

The publisher connection is closed during graceful shutdown:

```javascript
// In index.js shutdown handler
await closePublisher()
```

## Troubleshooting

### Publisher Not Connected

**Symptom**: Health check shows `publisher: "disconnected"`

**Solutions**:
1. Check RabbitMQ is running: `docker ps | grep rabbitmq`
2. Verify RabbitMQ credentials in `.env`
3. Check RabbitMQ logs: `docker logs <rabbitmq-container>`
4. Restart the service

### Events Not Being Consumed

**Symptom**: Events published but not received by consumer

**Solutions**:
1. Verify exchange exists: Check RabbitMQ Management UI
2. Verify queue is bound to exchange
3. Check consumer is running and connected
4. Verify queue name matches in consumer configuration

### Connection Errors

**Symptom**: `ECONNREFUSED` or connection timeout errors

**Solutions**:
1. Ensure RabbitMQ is accessible on the configured host/port
2. Check firewall rules
3. Verify network connectivity
4. Check RabbitMQ is accepting connections

## Best Practices

1. **Non-Blocking**: Publishing should never block the main transaction flow
2. **Error Logging**: Always log publishing errors for debugging
3. **Idempotency**: Consumers should handle duplicate events gracefully
4. **Monitoring**: Monitor queue depth and consumer lag
5. **Dead Letter Queue**: Consider adding a DLQ for failed message processing

## Related Files

- `backend/b2b-membership/utils/rabbitmq-publisher.js` - Publisher implementation
- `backend/b2b-membership/controllers/transfer-controller.js` - Event emission (Step 6/7)
- `backend/b2b-membership/services/transfer-service.js` - Blockchain transaction execution
- `backend/b2b-membership/index.js` - Publisher initialization
- `backend/b2b-membership/test-rabbitmq-publisher.js` - Test script
