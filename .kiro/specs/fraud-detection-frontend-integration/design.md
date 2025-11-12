# Design Document

## Overview

This design outlines the integration of fraud detection capabilities into the FinCube transaction dashboard. The feature will add a new column to the transaction table that displays real-time fraud risk assessments for transaction sender addresses by calling an external fraud detection API. The implementation focuses on non-blocking asynchronous loading, intelligent caching, and seamless integration with the existing React component architecture.

## Architecture

### Current State Analysis
- **Transaction Display**: Dashboard component renders transactions in a grid-based table
- **Data Flow**: Transactions loaded from The Graph via useTransactions hook
- **Styling**: Dual theme support (light/dark) with responsive breakpoints
- **State Management**: React hooks for local component state

### Target Architecture
- **API Integration**: RESTful POST endpoint for fraud detection
- **Async Loading**: Background fetching with progressive UI updates
- **Caching Layer**: localStorage-based result caching to minimize API calls
- **Component Enhancement**: Extend Dashboard with fraud detection rendering logic
- **Type Safety**: Update TypeScript interfaces to include fraud data

## Components and Interfaces

### 1. Fraud Detection API Integration

**Endpoint**: POST http://localhost:8000/fraud/score

**Request Format**:
```typescript
{
  address: string  // Ethereum wallet address
}
```

**Response Format**:
```typescript
{
  result: "Fraud" | "Not_Fraud" | "Undecided"
  fraud_probability: number  // 0-100
  confidence: number  // 0-100
}
```

**Expected Behavior**:
- Response time: 5-15 seconds per address
- Timeout handling: 30 seconds
- Error responses: Standard HTTP error codes

### 2. Data Models

#### Updated ParsedTransfer Interface
```typescript
interface ParsedTransfer {
  sender: string;
  recipient: string;
  amount: string;
  purpose: string;
  nullifier?: string;
  timestamp: number;
  txHash?: string;
  fraudResult?: "Fraud" | "Not_Fraud" | "Undecided" | "Error" | "Loading";
  fraudPercentage?: number;
  fraudConfidence?: number;
}
```

#### Fraud Cache Entry
```typescript
interface FraudCacheEntry {
  result: "Fraud" | "Not_Fraud" | "Undecided";
  fraud_probability: number;
  confidence: number;
  timestamp: number;  // Cache timestamp for potential expiration
}
```

### 3. Component Structure

#### Dashboard Component Enhancement

**New State**:
```typescript
const [fraudResults, setFraudResults] = useState<Map<string, FraudCacheEntry>>(new Map());
const [loadingFraud, setLoadingFraud] = useState<Set<string>>(new Set());
```

**New Functions**:
- `fetchFraudDetection(address: string): Promise<void>` - Fetch fraud data for an address
- `getCachedFraudResult(address: string): FraudCacheEntry | null` - Retrieve cached result
- `setCachedFraudResult(address: string, result: FraudCacheEntry): void` - Store result in cache
- `renderFraudCell(tx: ParsedTransfer): JSX.Element` - Render fraud detection cell

### 4. Table Layout Updates

#### Grid Column Configuration

**Before**:
```css
grid-template-columns: 150px 150px 140px 150px 200px 48px;
/* Sender | Recipient | Amount | Memo | Date | Etherscan */
```

**After**:
```css
grid-template-columns: 150px 150px 140px 150px 120px 200px 48px;
/* Sender | Recipient | Amount | Memo | Fraud Detection | Date | Etherscan */
```

**Responsive Behavior**:
- Desktop (>600px): All columns visible
- Mobile (<600px): Hide Fraud Detection column

### 5. Visual Design

#### Fraud Status Color Coding

**Fraud**:
- Background: #ef4444 (red)
- Text: #ffffff (white)
- Font weight: 700
- Border radius: 0.5rem

**Not_Fraud**:
- Background: #10b981 (green)
- Text: #ffffff (white)
- Font weight: 700
- Border radius: 0.5rem

**Undecided**:
- Background: #f59e0b (yellow)
- Text: #1f2937 (dark gray)
- Font weight: 700
- Border radius: 0.5rem

**Error**:
- Background: transparent
- Text: #6b7280 (gray)
- Font weight: 500
- Border radius: 0.5rem

**Loading**:
- Animated pulse effect
- Gray background with opacity animation
- Spinner icon or loading text

#### Cell Layout
```
┌─────────────────┐
│     FRAUD       │  ← Result (bold, colored)
│      85%        │  ← Probability (medium)
│   Conf: 92%     │  ← Confidence (small)
└─────────────────┘
```

## Implementation Strategy

### Phase 1: Data Layer
1. Update ParsedTransfer interface in graphService.ts
2. Implement localStorage caching utilities
3. Create fraud detection API client function

### Phase 2: UI Integration
1. Add "Fraud Detection" column header to table
2. Update CSS grid-template-columns in main.css and dark-theme.css
3. Implement renderFraudCell function with loading states

### Phase 3: Async Loading
1. Implement background fetching on transaction load
2. Add progressive UI updates as results arrive
3. Implement cache checking before API calls

### Phase 4: Error Handling & Polish
1. Add error state handling and display
2. Implement loading animations
3. Add responsive breakpoints for mobile
4. Test with various API response scenarios

## Caching Strategy

### Cache Key Format
```
fraud_cache_{address}
```

### Cache Entry Structure
```typescript
{
  result: string,
  fraud_probability: number,
  confidence: number,
  timestamp: number
}
```

### Cache Behavior
- **Cache Hit**: Use cached data immediately, no API call
- **Cache Miss**: Make API call, store result in cache
- **Cache Expiration**: Optional - could implement 24-hour expiration
- **Cache Invalidation**: Manual clear or on user action

## Error Handling

### API Error Scenarios
1. **Network Error**: Display "Error" in gray, log to console
2. **Timeout (>30s)**: Display "Error" in gray, log timeout
3. **Invalid Response**: Display "Error" in gray, log response
4. **Server Error (5xx)**: Display "Error" in gray, log status code

### Error Recovery
- Errors do not block other fraud detection calls
- User can manually refresh page to retry
- Cached results remain valid even if new calls fail

## Performance Considerations

### Optimization Strategies
1. **Parallel API Calls**: Fetch fraud data for all visible transactions simultaneously
2. **Request Deduplication**: Prevent multiple calls for the same address
3. **Cache First**: Always check cache before making API calls
4. **Progressive Loading**: Display table immediately, update cells as results arrive
5. **Pagination Awareness**: Only fetch fraud data for currently visible transactions

### Expected Performance
- Initial table render: <100ms (without fraud data)
- Fraud data population: 5-15 seconds per unique address
- Cached result display: <10ms
- Memory usage: Minimal (localStorage for cache)

## Responsive Design

### Breakpoint Strategy

**Desktop (>600px)**:
- All columns visible including Fraud Detection
- Full fraud information displayed (result, probability, confidence)

**Mobile (<600px)**:
- Hide Fraud Detection column
- Maintain other column visibility based on existing responsive rules
- Fraud data still fetched and cached for future desktop viewing

## Testing Strategy

### Unit Tests
- Test fraud detection API client function
- Test cache get/set utilities
- Test fraud cell rendering with different states

### Integration Tests
- Test full flow from transaction load to fraud display
- Test cache hit/miss scenarios
- Test error handling paths

### Manual Testing Scenarios
1. Load transactions with no cached fraud data
2. Load transactions with cached fraud data
3. Simulate API errors and timeouts
4. Test responsive behavior on mobile
5. Test with slow API responses (5-15s)
6. Test with mixed results (Fraud, Not_Fraud, Undecided)

## Security Considerations

- API endpoint should validate addresses server-side
- No sensitive data stored in localStorage cache
- API calls should include appropriate error handling
- Consider rate limiting on client side to prevent API abuse

## Future Enhancements

1. **Cache Expiration**: Implement 24-hour cache expiration
2. **Batch API Calls**: Send multiple addresses in single request
3. **Real-time Updates**: WebSocket connection for live fraud detection
4. **User Preferences**: Allow users to hide/show fraud detection column
5. **Detailed View**: Click fraud cell to see detailed fraud analysis
6. **Export**: Include fraud data in transaction exports
