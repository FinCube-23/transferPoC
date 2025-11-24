# Design Document

## Overview

The RabbitMQ Event Consumer is a Node.js module that integrates with an existing Express-based B2B membership system to consume events from a Django-based User Management System (UMS). The consumer establishes a connection to RabbitMQ, subscribes to specific routing keys on a topic exchange, processes incoming messages through dedicated handler functions, and persists all events to MongoDB for audit and replay capabilities.

The design follows the existing architectural patterns in the Express application, utilizing the established Logger utility, MongoDB connection management, and configuration system. The consumer operates as an independent module that can be started and stopped alongside the Express server lifecycle.

## Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Django UMS    │────────>│    RabbitMQ      │────────>│  Node.js        │
│   (Publisher)   │         │  Message Broker  │         │  Consumer       │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                                                   │
                                                                   │
                                                                   v
                                                          ┌─────────────────┐
                                                          │    MongoDB      │
                                                          │  Event Store    │
                                                          └─────────────────┘
```

### Component Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    RabbitMQ Consumer Module                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Connection Manager                              │ │
│  │  - Establish connection                                   │ │
│  │  - Handle reconnection with exponential backoff           │ │
│  │  - Graceful shutdown                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           │                                     │
│                           v                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Message Router                                  │ │
│  │  - Parse incoming messages                                │ │
│  │  - Route to appropriate handler                           │ │
│  │  - Handle acknowledgments                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           │                                     │
│                           v                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Event Handlers                                  │ │
│  │  - handleOrganizationCreated()                            │ │
│  │  - handleOrganizationUserCreated()                        │ │
│  │  - handleSyncAllData()                                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           │                                     │
│                           v                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Event Store                                     │ │
│  │  - Persist events to MongoDB                              │ │
│  │  - Provide audit trail                                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. RabbitMQ Consumer Module (`utils/rabbitmq-consumer.js`)

Main module that exports consumer lifecycle functions.

**Exports:**

```javascript
{
  startConsumer: () => Promise<void>,
  stopConsumer: () => Promise<void>
}
```

**Dependencies:**

-   `amqplib` - RabbitMQ client library
-   `mongoose` - MongoDB ODM (for Event model)
-   `./logger` - Existing logging utility
-   `../config/config` - Configuration management

### 2. Connection Manager

Manages RabbitMQ connection lifecycle with resilience features.

**Interface:**

```javascript
class ConnectionManager {
  constructor(config, logger)
  async connect(): Promise<Connection>
  async disconnect(): Promise<void>
  async reconnect(): Promise<Connection>
  isConnected(): boolean
}
```

**Configuration:**

```javascript
{
  host: string,        // Default: 'localhost'
  port: number,        // Default: 5672
  username: string,    // Default: 'guest'
  password: string,    // Default: 'guest'
  exchange: string,    // 'exchange.ums.events'
  exchangeType: string // 'topic'
}
```

### 3. Message Router

Routes incoming messages to appropriate handlers based on routing keys.

**Interface:**

```javascript
class MessageRouter {
  constructor(channel, logger)
  async setupQueue(): Promise<string>
  async bindRoutingKeys(queueName, routingKeys): Promise<void>
  async startConsuming(queueName): Promise<void>
  async handleMessage(message): Promise<void>
}
```

**Routing Map:**

```javascript
{
  'organization.created': handleOrganizationCreated,
  'organization.user.created': handleOrganizationUserCreated,
  'ums.sync': handleSyncAllData
}
```

### 4. Event Handlers

Process specific event types with business logic placeholders.

**Interface:**

```javascript
async function handleOrganizationCreated(payload: object): Promise<void>
async function handleOrganizationUserCreated(payload: object): Promise<void>
async function handleSyncAllData(payload: object): Promise<void>
```

**Handler Pattern:**

```javascript
async function handleEventType(payload) {
    const startTime = Date.now()
    logger.info(`Processing event: ${eventType}`, { payload })

    try {
        // TODO: Implement business logic here

        // Store event in MongoDB
        await storeEvent(routingKey, payload)

        const duration = Date.now() - startTime
        logger.info(`Event processed successfully`, { duration })
    } catch (error) {
        logger.error(`Error processing event`, {
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}
```

### 5. Event Store

Persists events to MongoDB for audit and replay.

**Mongoose Schema:**

```javascript
const EventSchema = new mongoose.Schema({
    routingKey: {
        type: String,
        required: true,
        index: true,
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    receivedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    processedAt: {
        type: Date,
    },
    status: {
        type: String,
        enum: ["received", "processing", "completed", "failed"],
        default: "received",
    },
    error: {
        type: String,
    },
})
```

**Interface:**

```javascript
async function storeEvent(routingKey, payload): Promise<Event>
async function updateEventStatus(eventId, status, error?): Promise<void>
```

## Data Models

### Event Model

Represents a received event from RabbitMQ.

```javascript
{
  _id: ObjectId,
  routingKey: String,        // e.g., 'organization.created'
  payload: Object,           // Parsed JSON payload
  receivedAt: Date,          // When message was received
  processedAt: Date,         // When processing completed
  status: String,            // 'received' | 'processing' | 'completed' | 'failed'
  error: String              // Error message if failed
}
```

### Message Format

Expected format of messages from UMS:

```javascript
{
  // Message properties
  routingKey: String,

  // Message body (JSON)
  body: {
    eventType: String,
    timestamp: String,
    data: Object
  }
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Connection retry follows exponential backoff

_For any_ connection failure, the retry delays should increase exponentially with each attempt, and the system should stop retrying after 10 attempts.

**Validates: Requirements 1.3, 1.4**

### Property 2: Messages route to correct handlers

_For any_ message with a subscribed routing key, the system should invoke the handler function that corresponds to that routing key.

**Validates: Requirements 2.4**

### Property 3: Unsubscribed messages are ignored

_For any_ message with a routing key that is not in the subscribed list, the system should not invoke any handler function.

**Validates: Requirements 2.5**

### Property 4: Successful processing triggers acknowledgment

_For any_ message that is processed successfully by a handler, the system should send an acknowledgment (ack) to RabbitMQ.

**Validates: Requirements 3.5, 8.2**

### Property 5: Valid JSON messages are parsed

_For any_ message with a valid JSON body, the system should successfully parse it into a JavaScript object.

**Validates: Requirements 4.1**

### Property 6: Parsed messages are stored with correct schema

_For any_ successfully parsed message, the stored event document should contain the fields routingKey, payload, and receivedAt.

**Validates: Requirements 4.2**

### Property 7: Successful storage is logged

_For any_ event that is successfully stored in MongoDB, the system should create a log entry containing the routing key and timestamp.

**Validates: Requirements 4.4**

### Property 8: Invalid JSON triggers error handling

_For any_ message with invalid JSON, the system should log the error with the raw message content and reject the message without requeue.

**Validates: Requirements 4.5, 8.4**

### Property 9: All received messages are logged

_For any_ message received from RabbitMQ, the system should create a log entry containing the routing key and message identifier.

**Validates: Requirements 5.2**

### Property 10: Successful processing is logged with duration

_For any_ message that is processed successfully, the system should log the success with the processing duration in milliseconds.

**Validates: Requirements 5.3**

### Property 11: Processing errors are logged with details

_For any_ error that occurs during message processing, the system should log the error with the full stack trace and message details.

**Validates: Requirements 5.4**

### Property 12: Handler errors don't terminate consumer

_For any_ error thrown by a handler function, the system should catch it, log it, and continue processing subsequent messages without terminating.

**Validates: Requirements 6.1, 6.5**

### Property 13: Parsing failures don't stop consumer

_For any_ message parsing failure, the system should reject the message and continue processing subsequent messages.

**Validates: Requirements 6.2**

### Property 14: Database failures trigger requeue

_For any_ database storage failure, the system should log the error and reject the message with requeue enabled.

**Validates: Requirements 6.3**

### Property 15: Handler timeouts are handled gracefully

_For any_ handler function that exceeds the timeout threshold, the system should log a timeout warning and reject the message with requeue enabled.

**Validates: Requirements 6.4**

### Property 16: Transient errors trigger requeue

_For any_ transient error (network, database timeout, etc.), the system should reject the message with requeue enabled.

**Validates: Requirements 8.3**

## Error Handling

### Error Classification

The consumer distinguishes between two types of errors:

1. **Transient Errors** (requeue enabled):

    - Network failures
    - Database connection timeouts
    - Temporary service unavailability
    - Handler function timeouts

2. **Permanent Errors** (no requeue):
    - JSON parsing failures
    - Invalid message format
    - Schema validation failures
    - Business logic validation failures

### Error Handling Flow

```
Message Received
     │
     v
Parse JSON ──────> [Parse Error] ──> Log + Reject (no requeue)
     │
     v
Route to Handler ──> [Unknown Route] ──> Log + Reject (no requeue)
     │
     v
Execute Handler ──> [Handler Error] ──> Classify Error
     │                                        │
     v                                        v
Store Event ──────> [DB Error] ──────> [Transient] ──> Log + Reject (requeue)
     │                                        │
     v                                        v
Acknowledge                            [Permanent] ──> Log + Reject (no requeue)
```

### Retry Strategy

**Connection Retry:**

-   Initial delay: 1 second
-   Backoff multiplier: 2
-   Maximum delay: 60 seconds
-   Maximum attempts: 10

**Formula:** `delay = min(initialDelay * (2 ^ attempt), maxDelay)`

**Example sequence:**

-   Attempt 1: 1s
-   Attempt 2: 2s
-   Attempt 3: 4s
-   Attempt 4: 8s
-   Attempt 5: 16s
-   Attempt 6: 32s
-   Attempt 7-10: 60s (capped)

## Testing Strategy

### Unit Testing

Unit tests will verify individual components and functions:

1. **Connection Manager Tests:**

    - Test successful connection establishment
    - Test connection with invalid credentials
    - Test graceful disconnection

2. **Message Router Tests:**

    - Test queue setup and binding
    - Test message routing to correct handlers
    - Test handling of unknown routing keys

3. **Event Handler Tests:**

    - Test each handler function with valid payloads
    - Test handler error handling
    - Test handler timeout behavior

4. **Event Store Tests:**
    - Test event persistence with valid data
    - Test schema validation
    - Test query operations

### Property-Based Testing

Property-based tests will verify universal properties using the `fast-check` library (already available in devDependencies):

1. **Connection Retry Property:**

    - Generate random connection failure scenarios
    - Verify exponential backoff calculation
    - Verify maximum attempt limit

2. **Message Routing Property:**

    - Generate random messages with various routing keys
    - Verify correct handler invocation for subscribed keys
    - Verify no handler invocation for unsubscribed keys

3. **JSON Parsing Property:**

    - Generate random valid JSON payloads
    - Verify successful parsing
    - Generate invalid JSON strings
    - Verify error handling

4. **Event Storage Property:**

    - Generate random event data
    - Verify stored documents contain required fields
    - Verify field types match schema

5. **Error Resilience Property:**

    - Generate random errors in handlers
    - Verify consumer continues processing
    - Verify error logging

6. **Acknowledgment Property:**
    - Generate random successful processing scenarios
    - Verify acknowledgment is sent
    - Generate random error scenarios
    - Verify rejection with appropriate requeue flag

**Configuration:**

-   Each property test will run a minimum of 100 iterations
-   Each property test will be tagged with: `**Feature: rabbitmq-event-consumer, Property {number}: {property_text}**`
-   Tests will use the existing `fast-check` library

### Integration Testing

Integration tests will verify end-to-end functionality:

1. **Full Message Flow:**

    - Start consumer
    - Publish test messages to RabbitMQ
    - Verify messages are received and processed
    - Verify events are stored in MongoDB
    - Verify acknowledgments are sent

2. **Error Recovery:**

    - Simulate RabbitMQ connection loss
    - Verify reconnection behavior
    - Verify message processing resumes

3. **Graceful Shutdown:**
    - Start consumer with in-flight messages
    - Trigger shutdown
    - Verify messages complete processing
    - Verify clean connection closure

## Configuration

### Environment Variables

```bash
# RabbitMQ Configuration
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_EXCHANGE=exchange.ums.events
RABBITMQ_EXCHANGE_TYPE=topic

# Consumer Configuration
RABBITMQ_PREFETCH_COUNT=10
RABBITMQ_HANDLER_TIMEOUT=30000  # 30 seconds
RABBITMQ_RECONNECT_MAX_ATTEMPTS=10
RABBITMQ_RECONNECT_INITIAL_DELAY=1000  # 1 second
RABBITMQ_RECONNECT_MAX_DELAY=60000  # 60 seconds

# Logging
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
```

### Configuration Module Extension

The existing `config/config.js` will be extended with RabbitMQ configuration:

```javascript
rabbitmq: {
  host: process.env.RABBITMQ_HOST || 'localhost',
  port: parseInt(process.env.RABBITMQ_PORT) || 5672,
  username: process.env.RABBITMQ_USERNAME || 'guest',
  password: process.env.RABBITMQ_PASSWORD || 'guest',
  exchange: process.env.RABBITMQ_EXCHANGE || 'exchange.ums.events',
  exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE || 'topic',
  routingKeys: [
    'organization.created',
    'organization.user.created',
    'ums.sync'
  ],
  prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH_COUNT) || 10,
  handlerTimeout: parseInt(process.env.RABBITMQ_HANDLER_TIMEOUT) || 30000,
  reconnect: {
    maxAttempts: parseInt(process.env.RABBITMQ_RECONNECT_MAX_ATTEMPTS) || 10,
    initialDelay: parseInt(process.env.RABBITMQ_RECONNECT_INITIAL_DELAY) || 1000,
    maxDelay: parseInt(process.env.RABBITMQ_RECONNECT_MAX_DELAY) || 60000
  }
}
```

## Integration with Express Application

### Startup Integration

The consumer will be integrated into the Express application startup in `index.js`:

```javascript
const { startConsumer, stopConsumer } = require("./utils/rabbitmq-consumer")

async function startServer() {
    try {
        // Connect to database
        await connectDatabase()

        // Start Express server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`)
        })

        // Start RabbitMQ consumer (non-blocking)
        startConsumer().catch((error) => {
            console.error("Failed to start RabbitMQ consumer:", error)
            // Consumer failure doesn't prevent server from running
        })
    } catch (error) {
        console.error("Failed to start server:", error)
        process.exit(1)
    }
}

// Graceful shutdown
async function shutdown(signal) {
    console.log(`${signal} received. Shutting down...`)

    try {
        await stopConsumer()
        await disconnectDatabase()
        process.exit(0)
    } catch (error) {
        console.error("Error during shutdown:", error)
        process.exit(1)
    }
}
```

### Docker Compose Integration

The `docker-compose.yml` will be extended to include RabbitMQ:

```yaml
services:
    rabbitmq:
        image: rabbitmq:3.12-management
        container_name: b2b-membership-rabbitmq
        restart: unless-stopped
        ports:
            - "5672:5672" # AMQP port
            - "15672:15672" # Management UI
        environment:
            RABBITMQ_DEFAULT_USER: guest
            RABBITMQ_DEFAULT_PASS: guest
        volumes:
            - rabbitmq_data:/var/lib/rabbitmq
        networks:
            - fincube23_network

volumes:
    rabbitmq_data:
        driver: local
```

## Dependencies

### New Dependencies

The following npm package needs to be added:

```json
{
    "dependencies": {
        "amqplib": "^0.10.3"
    }
}
```

### Installation

```bash
npm install amqplib
```

## Monitoring and Observability

### Logging

All consumer operations will be logged using the existing Logger utility:

-   Connection events (connect, disconnect, reconnect)
-   Message received events
-   Handler invocations
-   Event storage operations
-   Error events with full context

### Metrics

The following metrics should be tracked (for future implementation):

-   Messages received per routing key
-   Messages processed successfully
-   Messages rejected (with/without requeue)
-   Processing duration per handler
-   Connection uptime
-   Reconnection attempts

### Health Check

The existing `/health` endpoint will be extended to include RabbitMQ status:

```javascript
app.get("/health", (req, res) => {
    const mongoose = require("mongoose")
    const { isConsumerConnected } = require("./utils/rabbitmq-consumer")

    res.json({
        status: "ok",
        service: "b2b-membership",
        database:
            mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        rabbitmq: isConsumerConnected() ? "connected" : "disconnected",
    })
})
```

## Security Considerations

1. **Credentials Management:**

    - RabbitMQ credentials stored in environment variables
    - Never commit credentials to version control
    - Use `.env` file for local development

2. **Message Validation:**

    - Validate message structure before processing
    - Sanitize payload data before storage
    - Reject malformed messages

3. **Error Information:**

    - Avoid logging sensitive data in error messages
    - Sanitize payloads in logs if they contain PII

4. **Connection Security:**
    - Support for TLS/SSL connections (future enhancement)
    - Connection timeout configuration

## Future Enhancements

1. **Dead Letter Queue:**

    - Implement DLQ for permanently failed messages
    - Provide admin interface for DLQ inspection

2. **Message Replay:**

    - Implement replay functionality from event store
    - Support date range and routing key filters

3. **Metrics Dashboard:**

    - Implement Prometheus metrics export
    - Create Grafana dashboard for monitoring

4. **Circuit Breaker:**

    - Implement circuit breaker for downstream services
    - Prevent cascade failures

5. **Message Transformation:**
    - Support message schema versioning
    - Implement transformation pipelines
