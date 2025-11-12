# Requirements Document

## Introduction

Add fraud detection capabilities to the FinCube transaction dashboard by integrating with a fraud detection API service. The system will analyze transaction sender addresses and display fraud risk assessments directly in the transaction table, enabling users to quickly identify potentially fraudulent transactions.

## Glossary

- **Fraud Detection API**: The backend service endpoint at POST http://localhost:8000/fraud/score that analyzes wallet addresses for fraud indicators
- **Transaction Table**: The dashboard component displaying recent USDC transfers with sender, recipient, amount, memo, and date information
- **Fraud Score**: A numerical probability (0-100%) indicating the likelihood that an address is associated with fraudulent activity
- **Confidence Level**: A percentage indicating the model's confidence in its fraud assessment
- **ParsedTransfer**: The TypeScript interface representing a transaction record in the frontend application

## Requirements

### Requirement 1

**User Story:** As a user viewing transaction history, I want to see fraud detection results for each transaction sender, so that I can identify potentially risky transactions at a glance.

#### Acceptance Criteria

1. WHEN the transaction table loads, THE FinCube Frontend SHALL display a "Fraud Detection" column between the "Memo" and "Date" columns
2. WHEN a transaction row is rendered, THE FinCube Frontend SHALL call the fraud detection API with the sender address
3. WHEN the API returns a result, THE FinCube Frontend SHALL display the fraud status with appropriate color coding
4. WHEN the fraud status is "Fraud", THE FinCube Frontend SHALL display it with a red background (#ef4444) and white text
5. WHEN the fraud status is "Not_Fraud", THE FinCube Frontend SHALL display it with a green background (#10b981) and white text
6. WHEN the fraud status is "Undecided", THE FinCube Frontend SHALL display it with a yellow background (#f59e0b) and dark text

### Requirement 2

**User Story:** As a user, I want to see detailed fraud metrics including probability and confidence scores, so that I can make informed decisions about transaction risk.

#### Acceptance Criteria

1. WHEN fraud detection results are displayed, THE FinCube Frontend SHALL show the fraud probability as a percentage below the result text
2. WHEN fraud detection results are displayed, THE FinCube Frontend SHALL show the confidence level as smaller text below the probability
3. THE FinCube Frontend SHALL format the probability display as a percentage with the "%" symbol
4. THE FinCube Frontend SHALL format the confidence display with the prefix "Conf: " followed by the percentage
5. THE FinCube Frontend SHALL use appropriate font sizes to create visual hierarchy between result, probability, and confidence

### Requirement 3

**User Story:** As a user, I want the fraud detection to work efficiently without blocking the interface, so that I can view transactions immediately while fraud checks complete in the background.

#### Acceptance Criteria

1. WHEN the transaction table loads, THE FinCube Frontend SHALL display all transaction rows immediately without waiting for fraud detection results
2. WHILE fraud detection API calls are pending, THE FinCube Frontend SHALL display a loading indicator with an animated pulse effect in the fraud detection cell
3. WHEN fraud detection results arrive, THE FinCube Frontend SHALL update the corresponding cell without affecting other rows
4. THE FinCube Frontend SHALL cache fraud detection results in localStorage using the key pattern "fraud_cache_{address}"
5. WHEN displaying a transaction with a cached fraud result, THE FinCube Frontend SHALL use the cached data instead of making a new API call

### Requirement 4

**User Story:** As a user, I want the system to handle errors gracefully, so that API failures do not break the transaction display.

#### Acceptance Criteria

1. WHEN the fraud detection API call fails, THE FinCube Frontend SHALL display "Error" text in gray color in the fraud detection cell
2. WHEN the fraud detection API times out, THE FinCube Frontend SHALL handle it as an error condition
3. THE FinCube Frontend SHALL log API errors to the console for debugging purposes
4. WHEN an error occurs, THE FinCube Frontend SHALL not prevent other fraud detection calls from proceeding
5. THE FinCube Frontend SHALL continue to display all other transaction information correctly even when fraud detection fails

### Requirement 5

**User Story:** As a mobile user, I want the transaction table to remain usable on small screens, so that I can view transactions on any device.

#### Acceptance Criteria

1. WHEN the viewport width is less than 600px, THE FinCube Frontend SHALL hide the Fraud Detection column
2. WHEN the viewport width is 600px or greater, THE FinCube Frontend SHALL display the Fraud Detection column
3. THE FinCube Frontend SHALL maintain responsive behavior for all other columns at all breakpoints
4. THE FinCube Frontend SHALL apply responsive column hiding consistently in both light and dark themes
5. THE FinCube Frontend SHALL ensure the table layout remains properly aligned when columns are hidden

### Requirement 6

**User Story:** As a developer, I want the fraud detection feature to integrate seamlessly with existing code, so that it maintains consistency with the current architecture.

#### Acceptance Criteria

1. THE FinCube Frontend SHALL update the ParsedTransfer interface to include fraudPercentage and fraudResult fields
2. THE FinCube Frontend SHALL update grid-template-columns in both main.css and dark-theme.css to accommodate the new column
3. THE FinCube Frontend SHALL maintain the existing dark theme styling patterns for the fraud detection column
4. THE FinCube Frontend SHALL use the same table styling conventions as existing columns
5. THE FinCube Frontend SHALL follow the existing error handling patterns used in the application
