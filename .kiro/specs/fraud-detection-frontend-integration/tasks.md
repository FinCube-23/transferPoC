# Implementation Plan

- [ ] 1. Update data models and interfaces

  - [ ] 1.1 Update ParsedTransfer interface in graphService.ts
    - Add fraudResult field of type "Fraud" | "Not_Fraud" | "Undecided" | "Error" | "Loading" | undefined
    - Add fraudPercentage field of type number | undefined
    - Add fraudConfidence field of type number | undefined
    - _Requirements: 6.1_

  - [ ] 1.2 Create fraud detection types
    - Create FraudDetectionResponse interface with result, fraud_probability, and confidence fields
    - Create FraudCacheEntry interface for localStorage caching
    - _Requirements: 3.4, 6.1_

- [ ] 2. Implement fraud detection API client

  - [ ] 2.1 Create fraud detection service function
    - Implement fetchFraudScore function that calls POST http://localhost:8000/fraud/score
    - Add request body with address field
    - Add 30-second timeout handling
    - Add error handling for network failures and invalid responses
    - _Requirements: 1.2, 4.1, 4.2, 4.3_

  - [ ] 2.2 Implement caching utilities
    - Create getCachedFraudResult function to retrieve from localStorage
    - Create setCachedFraudResult function to store in localStorage
    - Use cache key pattern "fraud_cache_{address}"
    - Add timestamp to cache entries for potential expiration
    - _Requirements: 3.4, 3.5_

- [x] 3. Update table layout and styling

  - [x] 3.1 Update CSS grid columns in main.css
    - Modify .transactions-table-header grid-template-columns to add 120px column
    - Modify .transaction-row grid-template-columns to match header
    - Update from "150px 150px 140px 150px 200px 48px" to "150px 150px 140px 150px 120px 200px 48px"
    - _Requirements: 1.1, 6.2_

  - [x] 3.2 Update CSS grid columns in dark-theme.css
    - Update dark theme grid-template-columns to match main.css changes
    - Ensure consistent column widths across themes
    - _Requirements: 1.1, 6.2, 6.3_

  - [ ] 3.3 Add fraud cell styling
    - Create CSS classes for fraud status colors (fraud-status-fraud, fraud-status-not-fraud, fraud-status-undecided, fraud-status-error)
    - Add padding: 0.5rem, borderRadius: 0.5rem, fontSize: 0.75em, textAlign: center, fontWeight: 700
    - Implement color coding: Fraud (red #ef4444), Not_Fraud (green #10b981), Undecided (yellow #f59e0b), Error (gray #6b7280)
    - _Requirements: 1.4, 1.5, 1.6, 2.5_

  - [ ] 3.4 Add loading animation styles
    - Create CSS keyframes for pulse animation
    - Add loading spinner or animated indicator styles
    - _Requirements: 3.2_

  - [ ] 3.5 Add responsive breakpoints
    - Update main.css responsive rules to hide Fraud Detection column on mobile (<600px)
    - Update dark-theme.css responsive rules to match
    - Ensure grid-column adjustments for remaining columns when fraud column is hidden
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4. Implement Dashboard component fraud detection logic

  - [ ] 4.1 Add fraud detection state management
    - Add fraudResults state using useState with Map<string, FraudCacheEntry>
    - Add loadingFraud state using useState with Set<string>
    - Initialize states in Dashboard component
    - _Requirements: 3.1, 3.2_

  - [ ] 4.2 Implement fraud detection fetching logic
    - Create fetchFraudDetection async function that checks cache first
    - If cache miss, call fraud detection API
    - Update fraudResults state when API returns
    - Update loadingFraud state to track pending requests
    - Store results in localStorage cache
    - Handle errors gracefully and update state with error status
    - _Requirements: 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

  - [ ] 4.3 Implement background fetching on transaction load
    - Add useEffect hook that triggers when transactions change
    - Iterate through visible transactions and fetch fraud data for each unique sender
    - Implement request deduplication to prevent multiple calls for same address
    - Fetch in parallel for all addresses
    - _Requirements: 3.1, 3.2, 3.3, 4.4_

  - [ ] 4.4 Create renderFraudCell function
    - Implement function that takes ParsedTransfer and returns JSX for fraud cell
    - Check fraudResults state for the transaction's sender address
    - Display loading state with animated pulse if fraud detection is pending
    - Display fraud result with appropriate color coding when available
    - Display fraud probability as percentage below result
    - Display confidence as smaller text below probability (format: "Conf: XX%")
    - Display "Error" in gray if fraud detection failed
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 4.1_

- [ ] 5. Update transaction table rendering

  - [x] 5.1 Add Fraud Detection column header
    - Add "Fraud Detection" header div in transactions-table-header
    - Position between "Memo" and "Date" columns
    - Add appropriate styling and alignment (textAlign: center)
    - _Requirements: 1.1_

  - [ ] 5.2 Integrate fraud cell in transaction rows
    - Update renderTransactions function to include fraud detection cell
    - Call renderFraudCell for each transaction row
    - Position fraud cell between memo and date cells
    - Ensure proper grid column alignment
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 6. Testing and validation

  - [ ] 6.1 Test fraud detection API integration
    - Verify API calls are made with correct request format
    - Test with various response scenarios (Fraud, Not_Fraud, Undecided)
    - Test error handling for network failures and timeouts
    - Verify 30-second timeout works correctly
    - _Requirements: 1.2, 4.1, 4.2, 4.3_

  - [ ] 6.2 Test caching functionality
    - Verify cache stores results correctly in localStorage
    - Verify cache retrieval works and prevents duplicate API calls
    - Test cache key format "fraud_cache_{address}"
    - Verify cached results display immediately on subsequent loads
    - _Requirements: 3.4, 3.5_

  - [ ] 6.3 Test UI rendering and styling
    - Verify fraud status colors display correctly for all states
    - Verify probability and confidence display with correct formatting
    - Verify loading animation displays while API call is pending
    - Verify error state displays correctly
    - Test in both light and dark themes
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 6.3, 6.4_

  - [ ] 6.4 Test responsive behavior
    - Verify Fraud Detection column hides on mobile (<600px)
    - Verify column shows on desktop (>=600px)
    - Verify table layout remains correct when column is hidden
    - Test on various screen sizes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 6.5 Test performance and async loading
    - Verify table displays immediately without waiting for fraud data
    - Verify fraud cells update progressively as results arrive
    - Test with slow API responses (5-15 seconds)
    - Verify parallel API calls work correctly
    - Verify no blocking of UI during fraud detection
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 6.6 Test error scenarios
    - Test with API returning error responses
    - Test with network disconnection
    - Test with API timeout
    - Verify errors don't break transaction display
    - Verify errors are logged to console
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
