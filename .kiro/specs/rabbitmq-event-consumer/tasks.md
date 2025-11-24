# Implementation Plan

-   [x] 1. Set up project dependencies and configuration

    -   Install amqplib package for RabbitMQ client
    -   Extend config/config.js with RabbitMQ configuration section
    -   Add RabbitMQ environment variables to .env.example
    -   Update docker-compose.yml to include RabbitMQ service
    -   _Requirements: 1.1, 7.4_

-   [x] 2. Create Event model for MongoDB storage

    -   Define Mongoose schema for events collection with fields: routingKey, payload, receivedAt, processedAt, status, error
    -   Add indexes for routingKey and receivedAt fields
    -   Export Event model
    -   _Requirements: 4.2, 4.3_

-   [x] 3. Implement connection manager with retry logic

    -   Create ConnectionManager class with connect, disconnect, reconnect, and isConnected methods
    -   Implement exponential backoff algorithm for reconnection attempts
    -   Add maximum retry attempt limit (3 attempts)
    -   Integrate with existing Logger utility for connection events
    -   _Requirements: 1.1, 1.3, 1.4, 5.1_

-   [ ]\* 3.1 Write property test for exponential backoff

    -   **Property 1: Connection retry follows exponential backoff**
    -   **Validates: Requirements 1.3, 1.4**

-   [x] 4. Implement event store functions

    -   Create storeEvent function to persist events to MongoDB
    -   Create updateEventStatus function to update event processing status
    -   Add error handling for database operations
    -   Integrate with existing Logger for storage operations
    -   _Requirements: 4.2, 4.4, 5.1_

-   [ ]\* 4.1 Write property test for event storage schema

    -   **Property 6: Parsed messages are stored with correct schema**
    -   **Validates: Requirements 4.2**

-   [ ]\* 4.2 Write property test for storage logging

    -   **Property 7: Successful storage is logged**
    -   **Validates: Requirements 4.4**

-   [x] 5. Implement event handler functions

    -   Create handleOrganizationCreated function with TODO comment for business logic
    -   Create handleOrganizationUserCreated function with TODO comment for business logic
    -   Create handleSyncAllData function with TODO comment for business logic
    -   Add timing and logging to each handler
    -   Integrate event storage calls in each handler
    -   _Requirements: 3.1, 3.2, 3.3, 3.4, 5.3_

-   [ ]\* 5.1 Write property test for successful processing logging

    -   **Property 10: Successful processing is logged with duration**
    -   **Validates: Requirements 5.3**

-   [x] 6. Implement message router

    -   Create MessageRouter class with setupQueue, bindRoutingKeys, startConsuming, and handleMessage methods
    -   Implement routing map for routing keys to handler functions
    -   Add JSON parsing with error handling
    -   Implement message acknowledgment logic (ack for success, reject for errors)
    -   Add manual acknowledgment mode configuration
    -   _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.5, 8.1, 8.2_

-   [ ]\* 6.1 Write property test for message routing

    -   **Property 2: Messages route to correct handlers**
    -   **Validates: Requirements 2.4**

-   [ ]\* 6.2 Write property test for unsubscribed message filtering

    -   **Property 3: Unsubscribed messages are ignored**
    -   **Validates: Requirements 2.5**

-   [ ]\* 6.3 Write property test for JSON parsing

    -   **Property 5: Valid JSON messages are parsed**
    -   **Validates: Requirements 4.1**

-   [ ]\* 6.4 Write property test for invalid JSON handling

    -   **Property 8: Invalid JSON triggers error handling**
    -   **Validates: Requirements 4.5, 8.4**

-   [ ]\* 6.5 Write property test for acknowledgment

    -   **Property 4: Successful processing triggers acknowledgment**
    -   **Validates: Requirements 3.5, 8.2**

-   [x] 7. Implement error handling and resilience

    -   Add try-catch blocks around handler invocations
    -   Implement error classification (transient vs permanent)
    -   Add requeue logic based on error type
    -   Implement handler timeout mechanism
    -   Ensure consumer continues after handler errors
    -   Add comprehensive error logging with stack traces
    -   _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 5.4, 8.3, 8.4_

-   [ ]\* 7.1 Write property test for handler error resilience

    -   **Property 12: Handler errors don't terminate consumer**
    -   **Validates: Requirements 6.1, 6.5**

-   [ ]\* 7.2 Write property test for parsing failure resilience

    -   **Property 13: Parsing failures don't stop consumer**
    -   **Validates: Requirements 6.2**

-   [ ]\* 7.3 Write property test for database failure handling

    -   **Property 14: Database failures trigger requeue**
    -   **Validates: Requirements 6.3**

-   [ ]\* 7.4 Write property test for timeout handling

    -   **Property 15: Handler timeouts are handled gracefully**
    -   **Validates: Requirements 6.4**

-   [ ]\* 7.5 Write property test for transient error requeue

    -   **Property 16: Transient errors trigger requeue**
    -   **Validates: Requirements 8.3**

-   [ ]\* 7.6 Write property test for error logging

    -   **Property 11: Processing errors are logged with details**
    -   **Validates: Requirements 5.4**

-   [x] 8. Create main consumer module with lifecycle functions

    -   Create utils/rabbitmq-consumer.js module
    -   Implement startConsumer function that returns a Promise
    -   Implement stopConsumer function for graceful shutdown
    -   Implement isConsumerConnected function for health checks
    -   Add graceful shutdown logic that waits for in-flight messages
    -   Export startConsumer, stopConsumer, and isConsumerConnected functions
    -   _Requirements: 1.5, 7.1, 7.2, 7.3, 7.5, 8.5_

-   [ ]\* 8.1 Write property test for message logging

    -   **Property 9: All received messages are logged**
    -   **Validates: Requirements 5.2**

-   [x] 9. Integrate consumer with Express application

    -   Update index.js to import consumer functions
    -   Add startConsumer call in startServer function (non-blocking)
    -   Add stopConsumer call in graceful shutdown handler
    -   Ensure consumer failure doesn't prevent server startup
    -   _Requirements: 7.5, 1.5_

-   [x] 10. Extend health check endpoint

    -   Update /health endpoint to include RabbitMQ connection status
    -   Use isConsumerConnected function to check consumer status
    -   _Requirements: 7.1_

-   [x] 11. Create integration test for full message flow

    -   Write test that starts consumer, publishes messages, and verifies processing
    -   Test all three routing keys (organization.created, organization.user.created, ums.sync)
    -   Verify events are stored in MongoDB with correct schema
    -   Verify messages are acknowledged
    -   Clean up test data after test completion
    -   _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.2, 8.2_

-   [x] 12. Checkpoint - Ensure all tests pass
    -   Ensure all tests pass, ask the user if questions arise.
