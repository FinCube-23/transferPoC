# Organization Selection Flow

## Overview

After successful registration, users are automatically logged in and presented with an organization selection modal. This flow ensures users have an authentication token before fetching the organizations list.

## Flow Diagram

```
1. User fills registration form
   ↓
2. POST /api/users/register
   ← Success response
   ↓
3. Auto-login with same credentials (WITHOUT ZKP)
   POST /api/users/login
   ← Returns: { tokens, userProfile }
   Note: ZKP data skipped - user not in org yet
   ↓
4. Show Organization Selection Modal
   ↓
5. GET /api/organizations (with access token)
   ← Returns: { organizations[], pagination }
   ↓
6. User selects organization from dropdown
   ↓
7. Click "Join Organization" button
   ↓
8. POST /api/organizations/users
   Body: { user_id, organization_id }
   ← Success response
   ↓
9. Fetch updated user profile
   GET /api/users/profile
   ↓
10. Fetch ZKP user data (NOW available after org join)
    GET /api/query/user/{userId}
    ↓
11. Store in authStore and complete login
    ↓
12. Show Dashboard
```

## Components

### OrganizationModal

**Location**: `frontend/src/components/OrganizationModal.tsx`

**Props**:

- `userId: number` - The user's ID
- `accessToken: string` - JWT access token for API calls
- `onSuccess: () => void` - Callback when organization is joined

**Features**:

- Fetches organizations list on mount
- Displays organizations in a dropdown
- Shows detailed information about selected organization
- Handles join organization API call
- Loading and error states
- Auto-selects first organization

**Organization Display**:

- Name, email, type
- Address
- Status (with color coding)
- Member count

### AuthModal (Updated)

**Location**: `frontend/src/components/AuthModal.tsx`

**New State**:

- `showOrgModal: boolean` - Controls organization modal visibility
- `pendingAuth: { userId, accessToken }` - Stores auth data during org selection

**Updated Registration Flow**:

1. Register user
2. Auto-login with credentials
3. Store pending auth data
4. Show organization modal
5. After org joined, fetch updated profile
6. Complete authentication

## Key Implementation Details

### Why Skip ZKP During Registration?

**Problem**: ZKP user data doesn't exist until the user joins an organization.

**Solution**: Use `loginForRegistration()` method that:

- Fetches tokens and user profile only
- Skips ZKP data fetch
- Allows organization list to be fetched
- ZKP data fetched AFTER organization join

### AuthService Methods

**`login(credentials)`** - Full login with ZKP

- Used for normal login flow
- Fetches: tokens → profile → ZKP data
- Requires user to be in an organization

**`loginForRegistration(credentials)`** - Partial login without ZKP

- Used for registration auto-login
- Fetches: tokens → profile only
- Works before user joins organization

## Services

### OrganizationService

**Location**: `frontend/src/services/organizationService.ts`

#### Methods

**getOrganizations(accessToken: string)**

- Endpoint: `GET /api/organizations`
- Returns: `OrganizationsResponse`
- Requires: Bearer token authentication

**joinOrganization(payload, accessToken)**

- Endpoint: `POST /api/organizations/users`
- Payload: `{ user_id: number, organization_id: number }`
- Returns: `{ success: boolean, message?: string }`
- Requires: Bearer token authentication

#### Interfaces

```typescript
interface Organization {
  id: number;
  name: string;
  email: string;
  type: string;
  address: string;
  legal_entity_identifier: string;
  offchain_status: string;
  organization_admin: OrganizationAdmin;
  onchain_status: string | null;
  members: number[];
  created_at: string;
  updated_at: string;
}

interface OrganizationAdmin {
  id: number;
  email: string;
  full_name: string;
  status: string;
  phone_number: string;
  wallet_address: string | null;
}

interface OrganizationsResponse {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

## API Endpoints

### Get Organizations

**Request**:

```http
GET /api/organizations HTTP/1.1
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Response**:

```json
{
  "organizations": [
    {
      "id": 5,
      "name": "Bkash",
      "email": "bkash@gmail.com",
      "type": "plc",
      "address": "Dhaka, Bangladesh",
      "legal_entity_identifier": "TIN12345678901234567",
      "offchain_status": "approved",
      "organization_admin": {
        "id": 5,
        "email": "admin@example.com",
        "full_name": "Admin Name",
        "status": "approved",
        "phone_number": "+1234567890",
        "wallet_address": "0x..."
      },
      "onchain_status": "pending",
      "members": [5],
      "created_at": "2025-11-14T08:44:06.775517Z",
      "updated_at": "2025-11-14T08:44:06.775630Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2
  }
}
```

### Join Organization

**Request**:

```http
POST /api/organizations/users HTTP/1.1
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "user_id": 5,
  "organization_id": 4
}
```

**Response**:

```json
{
  "success": true,
  "message": "Successfully joined organization"
}
```

## User Experience

### Registration Success

1. User completes registration form
2. Sees "Creating account..." loading message
3. Sees "Logging in..." loading message
4. Organization modal appears automatically

### Organization Selection

1. Modal shows "Loading organizations..." spinner
2. Organizations load into dropdown
3. First organization auto-selected
4. Organization details displayed below dropdown
5. User can change selection
6. Click "Join Organization" button
7. Button shows "Joining..." with spinner
8. Success alert appears
9. Modal closes
10. Dashboard loads with user data

### Error Handling

**Organizations Load Error**:

- Shows error message in red box
- Provides "Retry" button
- Logs error to console

**Join Organization Error**:

- Shows alert with error message
- Button re-enables for retry
- Logs error to console

**Network Error**:

- Catches fetch errors
- Shows user-friendly message
- Allows retry

## Security Considerations

### Token Usage

- Access token required for all organization API calls
- Token obtained during auto-login after registration
- Token stored temporarily during org selection
- Token persisted in localStorage after completion

### Data Flow

- User credentials only used once for auto-login
- Credentials not stored anywhere
- Auth tokens follow standard JWT flow
- Organization data fetched with authenticated requests

## Testing

### Manual Testing Steps

1. **Registration Flow**:

   - Fill registration form with new user data
   - Submit form
   - Verify auto-login occurs
   - Verify organization modal appears

2. **Organization Selection**:

   - Verify organizations load
   - Verify first org auto-selected
   - Change selection
   - Verify details update
   - Click "Join Organization"
   - Verify success message
   - Verify dashboard loads

3. **Error Cases**:
   - Test with invalid token (should show error)
   - Test with network offline (should show error)
   - Test retry functionality

### Edge Cases

- No organizations available
- Single organization (auto-select)
- Multiple organizations
- Organization with null wallet_address
- Pending vs approved status display

## Future Enhancements

1. **Search/Filter**: Add search for organizations
2. **Pagination**: Handle large organization lists
3. **Organization Details**: Show more info before joining
4. **Leave Organization**: Add ability to leave/switch
5. **Invite System**: Join by invitation code
6. **Organization Creation**: Allow users to create orgs
7. **Multi-Organization**: Support multiple org memberships

---

**Last Updated**: November 27, 2025
