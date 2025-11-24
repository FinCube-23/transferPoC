# Requirements Document

## Introduction

This document specifies the requirements for a RabbitMQ event consumer module that integrates with an existing Express-based B2B membership system. The consumer will receive events from a Django-based User Management System (UMS) via RabbitMQ message broker and process organization and user-related events to maintain data synchronization between systems.

## Glossary

-   **RabbitMQ Consumer**: A Node.js module that connects to RabbitMQ and consumes messages from specified queues
-   **UMS**: User Management System - a Django-based system that publishes events
-   **Exchange**: A RabbitMQ routing mechanism that receives messages and routes them to queues (exchange.ums.events)
-   **Routing Key**: A message attribute used by exchanges to route messages to queues
-   **Message Acknowledgment**: Confirmation sent to RabbitMQ that a message has been successfully processed
-   **Event Store**: A MongoDB collection that persists received events for audit and replay purposes
-   **Express App**: The existing Node.js Express-based B2B membership application
-   **Topic Exchange**: A RabbitMQ exchange type that routes messages based on pattern matching of routing keys

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the RabbitMQ consumer to establish a reliable connection to the message broker, so that the system can receive events from the UMS.

#### Acceptance Criteria

1. WHEN the consumer module initializes THEN the system SHALL establish a connection to RabbitMQ at localhost:5672 using guest:guest credentials
2. WHEN the connection is established THEN the system SHALL bind to the exchange "exchange.ums.events" of type topic
3. WHEN the connection fails THEN the system SHALL log the error with connection details and retry with exponential backoff
4. WHEN the connection is lost THEN the system SHALL attempt automatic reconnection with exponential backoff up to a maximum of 10 attempts
5. WHEN the Express application shuts down THEN the system SHALL close the RabbitMQ connection gracefully

### Requirement 2

**User Story:** As a system integrator, I want the consumer to listen to specific routing keys, so that only relevant events are processed by the system.

#### Acceptance Criteria

1. WHEN the consumer binds to the exchange THEN the system SHALL subscribe to routing key "organization.created"
2. WHEN the consumer binds to the exchange THEN the system SHALL subscribe to routing key "organization.user.created"
3. WHEN the consumer binds to the exchange THEN the system SHALL subscribe to routing key "ums.sync"
4. WHEN a message arrives on any subscribed routing key THEN the system SHALL route it to the appropriate handler function
5. WHEN a message arrives on an unsubscribed routing key THEN the system SHALL ignore the message

### Requirement 3

**User Story:** As a developer, I want each event type to have a dedicated handler function, so that event-specific business logic can be implemented independently.

#### Acceptance Criteria

1. WHEN a message with routing key "organization.created" is received THEN the system SHALL invoke handleOrganizationCreated with the parsed payload
2. WHEN a message with routing key "organization.user.created" is received THEN the system SHALL invoke handleOrganizationUserCreated with the parsed payload
3. WHEN a message with routing key "ums.sync" is received THEN the system SHALL invoke handleSyncAllData with the parsed payload
4. WHEN any handler function is invoked THEN the system SHALL include a TODO comment indicating where business logic should be implemented
5. WHEN a handler function completes successfully THEN the system SHALL acknowledge the message to RabbitMQ

### Requirement 4

**User Story:** As a system operator, I want all received events to be persisted to MongoDB, so that I can audit event history and replay events if needed.

#### Acceptance Criteria

1. WHEN a message is received THEN the system SHALL parse the message body as JSON
2. WHEN the JSON is parsed successfully THEN the system SHALL store the event in the "events" collection with fields routingKey, payload, and receivedAt
3. WHEN storing the event THEN the system SHALL use the existing MongoDB connection from the Express application
4. WHEN the event is stored successfully THEN the system SHALL log the successful storage with routing key and timestamp
5. WHEN JSON parsing fails THEN the system SHALL log the error with the raw message content and reject the message

### Requirement 5

**User Story:** As a system operator, I want comprehensive logging of consumer operations, so that I can monitor system health and troubleshoot issues.

#### Acceptance Criteria

1. WHEN the consumer connects to RabbitMQ THEN the system SHALL log the connection success with broker details
2. WHEN a message is received THEN the system SHALL log the routing key and message identifier
3. WHEN a message is processed successfully THEN the system SHALL log the success with processing duration
4. WHEN an error occurs during message processing THEN the system SHALL log the error with full stack trace and message details
5. WHEN the consumer module uses logging THEN the system SHALL use the existing Logger utility from the Express application

### Requirement 6

**User Story:** As a developer, I want robust error handling throughout the consumer, so that individual message failures do not crash the entire consumer process.

#### Acceptance Criteria

1. WHEN a handler function throws an error THEN the system SHALL catch the error and log it without terminating the consumer
2. WHEN message parsing fails THEN the system SHALL reject the message and continue processing subsequent messages
3. WHEN database storage fails THEN the system SHALL log the error and reject the message for redelivery
4. WHEN a handler function times out THEN the system SHALL log a timeout warning and reject the message
5. WHEN an unhandled error occurs THEN the system SHALL log the error and maintain consumer availability

### Requirement 7

**User Story:** As a developer, I want the consumer module to be easily integrated into the existing Express application, so that minimal code changes are required.

#### Acceptance Criteria

1. WHEN the module is imported THEN the system SHALL export a startConsumer function that initializes the consumer
2. WHEN the module is imported THEN the system SHALL export a stopConsumer function that gracefully shuts down the consumer
3. WHEN startConsumer is called THEN the system SHALL return a Promise that resolves when the consumer is ready
4. WHEN the module initializes THEN the system SHALL use environment variables for RabbitMQ configuration (host, port, username, password)
5. WHEN the Express app starts THEN the system SHALL allow the consumer to be started independently without blocking server startup

### Requirement 8

**User Story:** As a system administrator, I want the consumer to handle message acknowledgments correctly, so that messages are not lost or processed multiple times.

#### Acceptance Criteria

1. WHEN a message is received THEN the system SHALL use manual acknowledgment mode
2. WHEN a message is processed successfully THEN the system SHALL send an acknowledgment (ack) to RabbitMQ
3. WHEN message processing fails THEN the system SHALL reject the message with requeue enabled for transient errors
4. WHEN message parsing fails permanently THEN the system SHALL reject the message without requeue
5. WHEN the consumer shuts down THEN the system SHALL wait for in-flight messages to complete before closing the connection
